"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import { useBoardActions } from "@/components/board-actions";
import { NodeDraftEditor, TopicActionsMenu, useMenuHold } from "@/components/topic-actions-menu";
import { StickyNotePanel } from "@/components/sticky-note-panel";
import { useChatHearts } from "@/hooks/use-chat-hearts";
import { usePulseCodes } from "@/hooks/use-pulse-codes";
import { LABEL_EDIT_MAX } from "@/lib/constants";
import { fitLabelFontSize } from "@/lib/fit-label";
import { cellCode } from "@/lib/mandala-ids";
import { MANDALA_CHIP_H, MANDALA_CHIP_W } from "@/lib/node-box";
import { cn } from "@/lib/utils";
import type { TopicNodeData } from "@/lib/types";

export type TopicFlowNode = Node<TopicNodeData, "topic">;

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return coarse;
}

function TopicNodeComponent({ id, data, selected }: NodeProps<TopicFlowNode>) {
  const {
    expandNode,
    regenerateNode,
    pinNode,
    setMemo,
    setLabel,
    copyLabel,
    toggleHeart,
    overlay,
    pinnedNodeId,
    focusedNodeId,
    generationLayout,
  } = useBoardActions();
  const [copied, setCopied] = useState(false);
  const [editor, setEditor] = useState<"label" | null>(null);
  const [memoOpen, setMemoOpen] = useState(false);
  const menu = useMenuHold();
  const coarse = useCoarsePointer();
  const pulses = usePulseCodes();
  const suppressClick = useRef(false);
  const holdTimer = useRef<number | null>(null);
  const isPinned = pinnedNodeId === id;
  const isFocused = focusedNodeId === id || selected;
  const isRoot = data.parentId === null;
  const isMandala = generationLayout === "mandala";
  const code =
    typeof data.groupId === "number" && typeof data.cellIndex === "number"
      ? cellCode(data.groupId, data.cellIndex)
      : "";
  const festiveHearts = useChatHearts(code);
  const family = data.familyIndex ?? 0;
  const role = data.role ?? (data.cellIndex === 4 ? "source" : "keyword");
  const canExpand = !data.expanded && !data.expanding && !data.placeholder;
  const fontSize = isMandala
    ? fitLabelFontSize(data.label, MANDALA_CHIP_W - 36, MANDALA_CHIP_H - 28, isRoot ? 16 : 15, 9)
    : fitLabelFontSize(data.label, 16 * 16 - 36, 72, isRoot ? 17 : 15, 10);
  const hearts = data.heartCount ?? 0;
  const pulsing = Boolean(code && pulses.includes(code));

  const openLabel = () => {
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

  return (
    <div
      className={cn(
        "topic-node relative",
        overlay && "topic-node-overlay",
        menu.open && "topic-node-menu",
        festiveHearts.length > 0 && "topic-node-festive",
      )}
      data-family={family}
      data-role={role}
      data-cell={data.cellIndex}
      onPointerEnter={() => {
        if (!overlay && !coarse) menu.show();
      }}
      onPointerLeave={() => {
        if (!overlay) menu.hideSoon();
      }}
      onPointerDown={(event) => {
        if (overlay || !coarse || event.pointerType !== "touch") return;
        clearHold();
        holdTimer.current = window.setTimeout(() => {
          suppressClick.current = true;
          menu.show();
        }, 480);
      }}
      onPointerUp={clearHold}
      onPointerCancel={clearHold}
      style={{
        ["--sprout-delay" as string]: `${data.appearIndex * 58}ms`,
        ["--sprout-x" as string]: `${Math.max(-72, Math.min(72, (data.sproutX ?? 0) * 0.28))}px`,
        ["--sprout-y" as string]: `${Math.max(-72, Math.min(72, (data.sproutY ?? 16) * 0.28))}px`,
      }}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0 !h-1 !w-1 !border-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !h-1 !w-1 !border-0" />

      {festiveHearts.length > 0 ? (
        <div className="topic-festive" aria-hidden>
          {festiveHearts.map((heart) => (
            <span
              key={heart.id}
              className="topic-festive-heart"
              style={{
                ["--hx" as string]: `${heart.dx}px`,
                ["--hy" as string]: `${heart.dy}px`,
                ["--hs" as string]: String(heart.scale),
              }}
            >
              ❤
            </span>
          ))}
        </div>
      ) : null}

      {data.placeholder ? null : overlay ? (
        hearts > 0 ? (
          <span className="topic-heart topic-heart-on" aria-label={`お気に入り ${hearts}`}>
            <span aria-hidden>❤</span>
            {hearts > 1 ? <span className="topic-heart-count">{hearts}</span> : null}
          </span>
        ) : null
      ) : (
        <button
          type="button"
          className={cn("topic-heart", hearts > 0 && "topic-heart-on")}
          aria-label={hearts > 0 ? `お気に入り ${hearts}` : "お気に入り"}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            toggleHeart?.(id);
          }}
        >
          <span aria-hidden>{hearts > 0 ? "❤" : "♡"}</span>
          {hearts > 1 ? <span className="topic-heart-count">{hearts}</span> : null}
        </button>
      )}

      {data.memo && !data.placeholder ? (
        <button
          type="button"
          className="topic-memo-badge"
          aria-label="付箋を開く"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            setMemoOpen(true);
          }}
        >
          📝
        </button>
      ) : null}

      <button
        type="button"
        className={cn(
          "topic-chip",
          isRoot && "topic-chip-root",
          isPinned && "topic-chip-now",
          isFocused && "topic-chip-focus",
          data.expanding && "topic-chip-busy",
          data.placeholder && "topic-chip-skeleton",
          role === "source" && "topic-chip-source",
          role === "keyword" && "topic-chip-keyword",
          pulsing && "topic-chip-pulse",
        )}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          if (data.placeholder || data.expanding) return;
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          if (canExpand) expandNode(id);
        }}
      >
        {data.placeholder ? (
          <span className="topic-skeleton" aria-label="話題を準備中">
            <span className="topic-skeleton-bud" />
            <span className="topic-skeleton-bar" />
          </span>
        ) : (
          <>
            {code ? <span className="topic-id">{code}</span> : null}
            <span className="topic-label" style={{ fontSize: `${fontSize}px` }}>
              {data.label}
            </span>
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

      {overlay ? null : (
        <TopicActionsMenu
          open={menu.open || editor === "label"}
          onOpenChange={menu.setOpen}
          isPinned={isPinned}
          copied={copied}
          onPin={() => pinNode(id)}
          onRegenerate={() => regenerateNode?.(id)}
          onCopy={async () => {
            await copyLabel(id);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
          onEditLabel={openLabel}
          onEditMemo={() => setMemoOpen(true)}
          onPointerEnter={menu.show}
          onPointerLeave={menu.hideSoon}
        />
      )}
    </div>
  );
}

export const TopicNode = memo(TopicNodeComponent);
