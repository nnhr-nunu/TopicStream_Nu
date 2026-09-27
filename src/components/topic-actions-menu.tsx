"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, CircleHelp, Combine, Copy, Grid3x3, ListChecks, Pencil, Pin, RefreshCw, ThumbsDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LABEL_EDIT_MAX, MEMO_MAX } from "@/lib/constants";
import { cn } from "@/lib/utils";

const LEAVE_MS = 480;

type MenuItem = {
  key: string;
  /** PC のメニューのツールチップ（読み上げ）用の説明 */
  label: string;
  /** スマホのメニューに出す短い名前 */
  short: string;
  icon: ReactNode;
  onClick: () => void;
};

export function TopicActionsMenu({
  open,
  onOpenChange,
  sheetTitle,
  isPinned,
  copied,
  onPin,
  onExpand,
  onDetail,
  detailRedo = false,
  onCombine,
  onExplain,
  onRegenerate,
  onReject,
  regenSpares = 0,
  regenReadyAt = 0,
  onCopy,
  onEditLabel,
  onEditMemo,
  onPointerEnter,
  onPointerLeave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** あればスマホ向けに、画面の下から出るメニューにする（見出しはカードの文） */
  sheetTitle?: string;
  isPinned: boolean;
  copied: boolean;
  onPin: () => void;
  /** 「具体的」モードのとき: タップの代わりにメニューから抽象展開（ふつうの広げ方）をする */
  onExpand?: () => void;
  /** 「具体的にする」 */
  onDetail?: () => void;
  /** 広げ済みのカード: 周りの 8 枚を具体的な内容に作り直す */
  detailRedo?: boolean;
  /** 掛け合わせる相手をタップで選ぶ */
  onCombine?: () => void;
  /** 解説: 言葉の短い解説を付箋に貼る */
  onExplain?: () => void;
  /** 無いときは作り直しを出さない（中心のカードは周りの話題とつながらなくなるので） */
  onRegenerate?: () => void;
  /** 予備の数。1以上なら API を呼ばず即座に作り直せる */
  regenSpares?: number;
  /** 「ずれている」の印を付けて作り直す（作り直せるカードだけ） */
  onReject?: () => void;
  /** 予備が無いとき、AI の作り直しが使えるようになる時刻 */
  regenReadyAt?: number;
  onCopy: () => void;
  onEditLabel: () => void;
  onEditMemo: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const items: MenuItem[] = [
    {
      key: "pin",
      label: isPinned ? "ピンを外す" : "いま話している",
      short: isPinned ? "ピンを外す" : "いま話している",
      icon: <Pin className={cn(isPinned && "fill-current")} />,
      onClick: onPin,
    },
  ];
  if (onExpand) {
    items.push({
      key: "expand",
      label: "抽象展開：切り口を8つ出す",
      short: "抽象展開",
      icon: <Grid3x3 />,
      onClick: onExpand,
    });
  }
  if (onDetail) {
    items.push({
      key: "detail",
      label: detailRedo
        ? "具体化：周りの8枚を具体案に作り直す"
        : "具体化：具体案を8つ出す",
      short: "具体化",
      icon: <ListChecks />,
      onClick: onDetail,
    });
  }
  if (onCombine) {
    items.push({
      key: "combine",
      label: sheetTitle
        ? "掛け合わせ：相手をタップ（長押しで重ねても可）"
        : "掛け合わせ：相手を選ぶ（ドラッグで重ねても可）",
      short: "掛け合わせ",
      icon: <Combine />,
      onClick: onCombine,
    });
  }
  if (onExplain) {
    items.push({
      key: "explain",
      label: "解説を付箋に貼る",
      short: "解説",
      icon: <CircleHelp />,
      onClick: onExplain,
    });
  }
  const tail: MenuItem[] = [];
  if (onReject) {
    tail.push({
      key: "reject",
      label: "ずれている：記録して作り直す",
      short: "ずれている",
      icon: <ThumbsDown />,
      onClick: onReject,
    });
  }
  tail.push(
    { key: "label", label: "文を直す", short: "文を直す", icon: <Pencil />, onClick: onEditLabel },
    {
      key: "memo",
      label: "付箋を書く",
      short: "付箋",
      icon: (
        <span className="text-base leading-none" aria-hidden>
          📝
        </span>
      ),
      onClick: onEditMemo,
    },
    {
      key: "copy",
      label: "コピー",
      short: copied ? "コピーしました" : "コピー",
      icon: copied ? <Check /> : <Copy />,
      onClick: onCopy,
    },
  );

  if (sheetTitle !== undefined) {
    return open ? (
      <TopicActionsSheet
        title={sheetTitle}
        items={items}
        tail={tail}
        regenerate={
          onRegenerate ? { spares: regenSpares, readyAt: regenReadyAt, onClick: onRegenerate } : undefined
        }
        onClose={() => onOpenChange(false)}
      />
    ) : null;
  }

  return (
    <div
      className={cn("topic-actions", open && "topic-actions-open")}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {items.map((item) => (
        <ActionBtn key={item.key} label={item.label} onClick={item.onClick}>
          {item.icon}
        </ActionBtn>
      ))}
      {onRegenerate ? (
        <RegenerateButton open={open} spares={regenSpares} readyAt={regenReadyAt} onClick={onRegenerate} />
      ) : null}
      {tail.map((item) => (
        <ActionBtn key={item.key} label={item.label} onClick={item.onClick}>
          {item.icon}
        </ActionBtn>
      ))}
      <span className="sr-only">{open ? "操作メニュー" : ""}</span>
      <button type="button" className="sr-only" onClick={() => onOpenChange(false)}>
        閉じる
      </button>
    </div>
  );
}

/**
 * スマホのメニュー: 画面の下から出す（カードの下に出すと画面の外にはみ出したり、指で隠れたりするので）。
 * 盤面の外（body）に出すので、React Flow のドラッグ・カードの長押しには伝えない。
 */
function TopicActionsSheet({
  title,
  items,
  tail,
  regenerate,
  onClose,
}: {
  title: string;
  items: MenuItem[];
  tail: MenuItem[];
  regenerate?: { spares: number; readyAt: number; onClick: () => void };
  onClose: () => void;
}) {
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();
  const render = (item: MenuItem) => (
    <button
      key={item.key}
      type="button"
      className="topic-sheet-btn"
      aria-label={item.label}
      onClick={() => item.onClick()}
    >
      <span className="topic-sheet-icon">{item.icon}</span>
      <span>{item.short}</span>
    </button>
  );
  return createPortal(
    <div
      className="topic-sheet-backdrop"
      onPointerDown={stop}
      onPointerMove={stop}
      onPointerUp={stop}
      onClick={(event) => {
        stop(event);
        onClose();
      }}
    >
      <div className="topic-sheet" role="dialog" aria-label="カードの操作" onClick={stop}>
        <div className="topic-sheet-head">
          <p className="topic-sheet-title">{title}</p>
          <button type="button" className="topic-sheet-close" aria-label="閉じる" onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        <div className="topic-sheet-grid">
          {items.map(render)}
          {regenerate ? <SheetRegenerate {...regenerate} /> : null}
          {tail.map(render)}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SheetRegenerate({ spares, readyAt, onClick }: { spares: number; readyAt: number; onClick: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const cooling = spares === 0 && readyAt > now;
  useEffect(() => {
    if (spares > 0 || readyAt <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [spares, readyAt]);
  const seconds = Math.max(1, Math.ceil((readyAt - now) / 1000));
  return (
    <button
      type="button"
      className="topic-sheet-btn"
      disabled={cooling}
      aria-label={cooling ? `あと ${seconds} 秒で作り直せます` : "作り直す"}
      onClick={onClick}
    >
      <span className="topic-sheet-icon">
        <RefreshCw />
      </span>
      <span>{cooling ? `あと${seconds}秒` : spares > 0 ? `作り直す（${spares}）` : "作り直す"}</span>
    </button>
  );
}

/** 作り直し: 予備があれば即座に。無ければトピック図鑑、それも無ければ AI を呼ぶので、使った直後は残り秒数を出して待ってもらう。 */
function RegenerateButton({
  open,
  spares,
  readyAt,
  onClick,
}: {
  open: boolean;
  spares: number;
  readyAt: number;
  onClick: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const cooling = spares === 0 && readyAt > now;
  useEffect(() => {
    if (!open || spares > 0 || readyAt <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [open, spares, readyAt]);
  const seconds = Math.max(1, Math.ceil((readyAt - now) / 1000));
  const label = cooling
    ? `あと ${seconds} 秒で作り直せます`
    : spares > 0
      ? `作り直す（候補あと ${spares}）`
      : "作り直す";
  return (
    <ActionBtn label={label} onClick={onClick} disabled={cooling}>
      {cooling ? <span className="topic-regen-countdown">{seconds}</span> : <RefreshCw />}
      {spares > 0 && !cooling ? <span className="topic-regen-spares" aria-hidden>{spares}</span> : null}
    </ActionBtn>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon-lg"
      variant="ghost"
      aria-label={label}
      title={label}
      disabled={disabled}
      className="topic-action-btn"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {children}
    </Button>
  );
}

export function useMenuHold() {
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const timer = useRef<number | null>(null);

  const clear = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const show = () => {
    clear();
    setOpen(true);
  };

  const hideSoon = () => {
    if (locked) return;
    clear();
    timer.current = window.setTimeout(() => setOpen(false), LEAVE_MS);
  };

  const hideNow = () => {
    if (locked) return;
    clear();
    setOpen(false);
  };

  useEffect(() => () => clear(), []);

  return { open, setOpen, locked, setLocked, show, hideSoon, hideNow, clear };
}

export function NodeDraftEditor({
  title,
  value,
  maxLength,
  placeholder,
  onCommit,
  onCancel,
}: {
  title: string;
  value: string;
  maxLength: number;
  placeholder: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const node = ref.current;
    if (!node) return;
    node.setSelectionRange(node.value.length, node.value.length);
  }, []);

  const finish = () => onCommit(draft);

  return (
    <div
      className="topic-editor nodrag nowheel nopan"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <p className="mb-1.5 text-[11px] text-muted-foreground">{title}</p>
      <Textarea
        ref={ref}
        value={draft}
        maxLength={maxLength}
        placeholder={placeholder}
        className="min-h-20"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            finish();
          }
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">
          {draft.length}/{maxLength}
        </span>
        <div className="flex gap-1">
          <Button type="button" size="xs" variant="ghost" onClick={onCancel}>
            やめる
          </Button>
          <Button type="button" size="xs" onClick={finish}>
            完了
          </Button>
        </div>
      </div>
    </div>
  );
}

export const EDITOR_LIMITS = { label: LABEL_EDIT_MAX, memo: MEMO_MAX };
