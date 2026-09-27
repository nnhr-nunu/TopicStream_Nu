"use client";

import { memo, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import { useBoardActions } from "@/components/board-actions";
import { useCombine } from "@/components/combine-drag";
import { NodeDraftEditor, TopicActionsMenu, useMenuHold } from "@/components/topic-actions-menu";
import { ExplainPanel } from "@/components/explain-panel";
import { StickyNotePanel } from "@/components/sticky-note-panel";
import { useChatHearts } from "@/hooks/use-chat-hearts";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { usePulseCodes } from "@/hooks/use-pulse-codes";
import { LABEL_EDIT_MAX } from "@/lib/constants";
import { appendToMemo } from "@/lib/explain";
import { fitLabelFontSize } from "@/lib/fit-label";
import { formatHeartCount, totalHearts } from "@/lib/live-hearts";
import { cellCode } from "@/lib/mandala-ids";
import { isSentenceCard, MANDALA_CHIP_H, MANDALA_CHIP_W, splitGloss } from "@/lib/node-box";
import { cn } from "@/lib/utils";
import type { TopicNodeData } from "@/lib/types";

/** openedCode: マンダラートで開いた先の中央コード（画面表示用。保存しない） */
export type TopicFlowNode = Node<TopicNodeData & { openedCode?: string }, "topic">;

/** 長押しと見なすまでの時間と、それまでに動いてよい距離（超えたら盤面のスクロール） */
const HOLD_MS = 450;
const HOLD_SLOP = 10;
/** 持ち上げたあと、これ以上動かしたら掛け合わせのドラッグ */
const LIFT_DRAG = 12;

function TopicNodeComponent({ id, data, selected, dragging }: NodeProps<TopicFlowNode>) {
  const {
    expandNode,
    regenerateNode,
    pinNode,
    setMemo,
    setLabel,
    detailNode,
    rejectNode,
    explainNode,
    copyLabel,
    toggleHeart,
    overlay,
    viewer,
    pinnedNodeId,
    focusedNodeId,
    regeneratingIds,
    regenReadyAt,
    spareCountFor,
    generationLayout,
    expandMode,
  } = useBoardActions();
  const [copied, setCopied] = useState(false);
  const [editor, setEditor] = useState<"label" | null>(null);
  const [memoOpen, setMemoOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const menu = useMenuHold();
  const coarse = useCoarsePointer();
  const combine = useCombine();
  const pulses = usePulseCodes();
  const suppressClick = useRef(false);
  const holdTimer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  /** スマホ: 触り始め → 長押しで持ち上げ（lifted）→ 動かすと掛け合わせのドラッグ（drag） */
  const touch = useRef<{ pointerId: number; x: number; y: number; phase: "down" | "lifted" | "drag" } | null>(null);
  const [lifted, setLifted] = useState(false);
  const isPinned = pinnedNodeId === id;
  const regenerating = Boolean(regeneratingIds?.includes(id));
  // メニューから別の画面（付箋・作り直し）へ進んだら、メニューは閉じてフォーカスも外す
  const leaveMenu = () => {
    menu.hideNow();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };
  const isFocused = focusedNodeId === id || selected;
  const isRoot = data.parentId === null;
  const isMandala = generationLayout === "mandala";
  const code =
    typeof data.groupId === "number" && typeof data.cellIndex === "number"
      ? cellCode(data.groupId, data.cellIndex)
      : "";
  const heartBurst = useChatHearts(code);
  const family = data.familyIndex ?? 0;
  const role = data.role ?? (data.cellIndex === 4 ? "source" : "keyword");
  // 「具体的にする」で出た答えのカードも、ふつうのカードと同じように広げられる
  const canExpand = !data.expanded && !data.expanding && !data.placeholder;
  // 「具体的」モード: タップで「具体的にする」、メニューには逆の「抽象展開」を出す
  const tapDetail = expandMode === "detail" && Boolean(detailNode);
  // 「言葉：意味」のカードは、語を大きく・意味を小さく 2 段に
  const gloss = isRoot ? null : splitGloss(data.label);
  // 文のカード（「具体的にする」の答え・図鑑から取り込んだ長い文）は小さめの文字で左寄せ
  const sentence = !gloss && isSentenceCard(data);
  const labelMax = sentence ? 13 : isRoot ? 16 : 15;
  const labelW = isMandala ? MANDALA_CHIP_W - 36 : 16 * 16 - 36;
  const labelH = isMandala ? MANDALA_CHIP_H - 28 : 72;
  const fontSize = gloss
    ? fitLabelFontSize(gloss.term, labelW, labelH * 0.5, 16, 10)
    : isMandala
      ? fitLabelFontSize(data.label, labelW, labelH, labelMax, 9)
      : fitLabelFontSize(data.label, labelW, labelH, sentence ? 13 : isRoot ? 17 : 15, 10);
  const meaningSize = gloss ? fitLabelFontSize(gloss.meaning, labelW, labelH * 0.5, 11.5, 8) : 0;
  const hearts = totalHearts(data);
  const liked = (data.heartCount ?? 0) > 0;
  // 自分のハート1つだけのときは数字を出さない。コメントのハートがあれば累計を出す。
  const showCount = hearts > 1 || (data.frameHearts ?? 0) > 0;
  const pulsing = Boolean(code && pulses.includes(code));

  const openLabel = () => {
    // スマホのメニューは下から出る別の画面なので、閉じてからカードの下に入力欄を出す
    if (coarse) {
      leaveMenu();
      setEditor("label");
      return;
    }
    menu.setLocked(true);
    menu.show();
    setEditor("label");
  };

  const closeLabel = () => {
    setEditor(null);
    menu.setLocked(false);
  };

  const clearHold = () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const endTouch = () => {
    clearHold();
    touch.current = null;
    setLifted(false);
  };

  // スマホ: 長押しでカードを持ち上げる。そのまま離すとメニュー、動かして別のカードに重ねると掛け合わせ。
  // 長押しの前に動いたら盤面のスクロールとして扱う（触っただけでカードが動いたり掛け合わさったりしないように）
  // カード本体のボタンは pointerdown を止めるので、そこからも呼ぶ
  const startHold = (event: ReactPointerEvent) => {
    if (overlay || !coarse || event.pointerType !== "touch" || data.placeholder) return;
    if (touch.current) {
      // 2 本目の指（ピンチ）なら長押しをやめる
      if (touch.current.phase === "drag") combine?.touchCancel();
      endTouch();
      return;
    }
    clearHold();
    touch.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, phase: "down" };
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      if (!touch.current) return;
      touch.current.phase = "lifted";
      suppressClick.current = true;
      setLifted(true);
      navigator.vibrate?.(12);
    }, HOLD_MS);
  };

  const moveTouch = (event: ReactPointerEvent) => {
    const state = touch.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const moved = Math.hypot(event.clientX - state.x, event.clientY - state.y);
    if (state.phase === "down") {
      if (moved > HOLD_SLOP) endTouch();
      return;
    }
    if (state.phase === "lifted") {
      if (moved <= LIFT_DRAG || !combine) return;
      state.phase = "drag";
      combine.touchStart(id, data.label, event.clientX, event.clientY);
      return;
    }
    combine?.touchMove(event.clientX, event.clientY);
  };

  const releaseTouch = (event: ReactPointerEvent) => {
    const state = touch.current;
    if (!state || state.pointerId !== event.pointerId) {
      clearHold();
      return;
    }
    if (state.phase === "drag") combine?.touchEnd(event.clientX, event.clientY);
    else if (state.phase === "lifted") menu.show();
    endTouch();
  };

  const cancelTouch = () => {
    if (touch.current?.phase === "drag") combine?.touchCancel();
    endTouch();
  };

  // 持ち上げている間は、指の動きで盤面がスクロールしないようにする（React Flow は touchmove で動かす）
  useEffect(() => {
    const element = rootRef.current;
    if (!element || !coarse || overlay) return;
    const stop = (event: TouchEvent) => {
      const phase = touch.current?.phase;
      if (phase === "lifted" || phase === "drag") {
        event.stopPropagation();
        if (event.cancelable) event.preventDefault();
      }
    };
    element.addEventListener("touchmove", stop, { passive: false });
    return () => element.removeEventListener("touchmove", stop);
  }, [coarse, overlay]);

  useEffect(
    () => () => {
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
    },
    [],
  );

  // PC: ドラッグし始めたらメニューを閉じる（離したあとカードが元の位置へ戻っても開いたまま残らないように）
  const setMenuOpen = menu.setOpen;
  useEffect(() => {
    if (dragging) setMenuOpen(false);
  }, [dragging, setMenuOpen]);

  return (
    <div
      ref={rootRef}
      className={cn(
        "topic-node relative",
        overlay && !viewer && "topic-node-overlay",
        menu.open && "topic-node-menu",
        lifted && "topic-node-lifted",
      )}
      data-family={family}
      data-role={role}
      data-cell={data.cellIndex}
      onPointerEnter={() => {
        if (!overlay && !coarse && !dragging) menu.show();
      }}
      onPointerLeave={() => {
        // スマホは指を離すと pointerleave が来るので、メニュー（下から出る）は閉じるボタンか外側のタップで閉じる
        if (!overlay && !coarse) menu.hideSoon();
      }}
      onPointerDown={startHold}
      onPointerMove={moveTouch}
      onPointerUp={releaseTouch}
      onPointerCancel={cancelTouch}
      style={{
        animationDelay: `${data.appearIndex * 58}ms`,
        ["--sprout-x" as string]: `${Math.max(-72, Math.min(72, (data.sproutX ?? 0) * 0.28))}px`,
        ["--sprout-y" as string]: `${Math.max(-72, Math.min(72, (data.sproutY ?? 16) * 0.28))}px`,
      }}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0 !h-1 !w-1 !border-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !h-1 !w-1 !border-0" />

      {data.placeholder ? null : overlay ? (
        hearts > 0 ? (
          <span className="topic-heart topic-heart-on" aria-label={`ハート ${hearts}`}>
            <span aria-hidden>❤</span>
            {showCount ? <span className="topic-heart-count">{formatHeartCount(hearts)}</span> : null}
            {heartBurst ? (
              <span key={heartBurst.key} className="topic-heart-plus" aria-hidden>
                +{heartBurst.count}
              </span>
            ) : null}
          </span>
        ) : null
      ) : (
        <button
          type="button"
          className={cn("topic-heart", hearts > 0 && "topic-heart-on", liked && "topic-heart-mine")}
          aria-label={hearts > 0 ? `ハート ${hearts}（押すと自分のハートを切り替え）` : "ハートを付ける"}
          aria-pressed={liked}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            toggleHeart?.(id);
          }}
        >
          <span aria-hidden>{hearts > 0 ? "❤" : "♡"}</span>
          {showCount ? <span className="topic-heart-count">{formatHeartCount(hearts)}</span> : null}
          {heartBurst ? (
            <span key={heartBurst.key} className="topic-heart-plus" aria-hidden>
              +{heartBurst.count}
            </span>
          ) : null}
        </button>
      )}

      {lifted ? (
        <span className="topic-lift-hint" aria-hidden>
          離すとメニュー
          <br />
          動かして重ねると掛け合わせ
        </span>
      ) : null}

      {isPinned && !data.placeholder ? (
        <span className="topic-now-ribbon" aria-hidden>
          NOW
        </span>
      ) : null}

      {data.memo && !data.placeholder && !overlay ? (
        <button
          type="button"
          className="topic-memo-tag nodrag"
          aria-label={`付箋: ${data.memo}（開いて編集）`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            setMemoOpen(true);
          }}
        >
          <span className="topic-memo-tag-text">{data.memo}</span>
          <span className="topic-memo-tag-full" aria-hidden>
            {data.memo}
          </span>
        </button>
      ) : null}

      <button
        type="button"
        className={cn(
          "topic-chip",
          isRoot && "topic-chip-root",
          isPinned && "topic-chip-now",
          isFocused && "topic-chip-focus",
          (data.expanding || regenerating) && "topic-chip-busy",
          regenerating && "topic-chip-regen",
          data.placeholder && "topic-chip-skeleton",
          role === "source" && "topic-chip-source",
          role === "keyword" && "topic-chip-keyword",
          sentence && "topic-chip-detail",
          data.mixedFromId && "topic-chip-mix",
          pulsing && "topic-chip-pulse",
        )}
        onPointerDown={(event) => {
          event.stopPropagation();
          startHold(event);
        }}
        onContextMenu={(event) => {
          if (coarse) event.preventDefault();
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          // ドラッグして元の場所で離したときは、タップ（広げる）にしない
          if (combine?.justDropped()) return;
          if (data.placeholder) return;
          // メニューの「掛け合わせる」で相手を選んでいる途中
          if (combine?.pickTarget(id)) return;
          if (data.expanding || regenerating) return;
          if (!canExpand) return;
          if (tapDetail) detailNode?.(id);
          else expandNode(id);
        }}
      >
        {data.placeholder ? (
          <span className="topic-skeleton" aria-label="話題を準備中">
            <span className="topic-skeleton-bud" />
            <span className="topic-skeleton-bar" />
          </span>
        ) : (
          <>
            {code ? (
              <span className="topic-id">
                {code}
                {data.openedCode ? (
                  <span className="topic-opened" title={`${data.openedCode} に広げました`}>
                    →{data.openedCode}
                  </span>
                ) : null}
              </span>
            ) : null}
            {/* key で語が入れ替わるたびに付け直し、ぽこっと出るアニメーションを毎回かける */}
            <span
              key={data.label}
              className="topic-label topic-label-pop"
              title={sentence ? data.label : undefined}
              style={{ fontSize: `calc(${fontSize}px * var(--ts-scale))` }}
            >
              {gloss ? (
                <>
                  <span className="topic-gloss-term">{gloss.term}</span>
                  <span className="sr-only">：</span>
                  <span className="topic-gloss-meaning" style={{ fontSize: `calc(${meaningSize}px * var(--ts-scale))` }}>
                    {gloss.meaning}
                  </span>
                </>
              ) : (
                data.label
              )}
            </span>
            {regenerating ? (
              <span className="topic-regen-badge" role="status">
                <span className="topic-regen-spinner" aria-hidden />
                作り直し中…
              </span>
            ) : null}
          </>
        )}
      </button>

      {overlay || editor !== "label" ? null : (
        <NodeDraftEditor
          title="カードの文"
          value={data.label}
          maxLength={LABEL_EDIT_MAX}
          placeholder="話したいことを書く"
          onCommit={(next) => {
            setLabel?.(id, next);
            closeLabel();
          }}
          onCancel={closeLabel}
        />
      )}

      <StickyNotePanel
        open={memoOpen}
        title={data.label}
        value={data.memo}
        readOnly={overlay}
        onOpenChange={setMemoOpen}
        onCommit={(next) => setMemo(id, next)}
      />

      {overlay || !explainNode ? null : (
        <ExplainPanel
          open={explainOpen}
          label={data.label}
          onOpenChange={setExplainOpen}
          explain={() => explainNode(id, data.label)}
          onAttach={(text) => setMemo(id, appendToMemo(data.memo, text))}
        />
      )}

      {overlay ? null : (
        <TopicActionsMenu
          open={(menu.open || (!coarse && editor === "label")) && !dragging}
          sheetTitle={coarse ? data.label : undefined}
          onCombine={
            combine && !data.placeholder
              ? () => {
                  leaveMenu();
                  combine.startPick(id);
                }
              : undefined
          }
          onExplain={
            explainNode && !data.placeholder
              ? () => {
                  leaveMenu();
                  setExplainOpen(true);
                }
              : undefined
          }
          onOpenChange={menu.setOpen}
          isPinned={isPinned}
          copied={copied}
          onPin={() => pinNode(id)}
          detailRedo={Boolean(data.expanded)}
          onExpand={
            tapDetail && canExpand
              ? () => {
                  leaveMenu();
                  expandNode(id);
                }
              : undefined
          }
          onDetail={
            ((canExpand && !tapDetail) || (data.expanded && !data.expanding)) && detailNode
              ? () => {
                  leaveMenu();
                  detailNode(id);
                }
              : undefined
          }
          regenSpares={menu.open ? (spareCountFor?.(id) ?? 0) : 0}
          regenReadyAt={regenReadyAt ?? 0}
          onRegenerate={
            isRoot || data.expanded
              ? undefined
              : () => {
                  leaveMenu();
                  regenerateNode?.(id);
                }
          }
          onReject={
            isRoot || data.expanded || !rejectNode
              ? undefined
              : () => {
                  leaveMenu();
                  rejectNode(id);
                }
          }
          onCopy={async () => {
            await copyLabel(id);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
          onEditLabel={openLabel}
          onEditMemo={() => {
            leaveMenu();
            setMemoOpen(true);
          }}
          onPointerEnter={menu.show}
          onPointerLeave={menu.hideSoon}
        />
      )}
    </div>
  );
}

export const TopicNode = memo(TopicNodeComponent);
