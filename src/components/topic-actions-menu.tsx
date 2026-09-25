"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy, Pencil, Pin, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LABEL_EDIT_MAX, MEMO_MAX } from "@/lib/constants";
import { cn } from "@/lib/utils";

const LEAVE_MS = 480;

export function TopicActionsMenu({
  open,
  onOpenChange,
  isPinned,
  copied,
  onPin,
  onRegenerate,
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
  isPinned: boolean;
  copied: boolean;
  onPin: () => void;
  onRegenerate: () => void;
  /** 予備の数。1以上なら API を呼ばず即座に作り直せる */
  regenSpares?: number;
  /** 予備が無いとき、AI の作り直しが使えるようになる時刻 */
  regenReadyAt?: number;
  onCopy: () => void;
  onEditLabel: () => void;
  onEditMemo: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  return (
    <div
      className={cn("topic-actions", open && "topic-actions-open")}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <ActionBtn label={isPinned ? "ピンを外す" : "いま話している"} onClick={onPin}>
        <Pin className={cn(isPinned && "fill-current")} />
      </ActionBtn>
      <RegenerateButton open={open} spares={regenSpares} readyAt={regenReadyAt} onClick={onRegenerate} />
      <ActionBtn label="文を直す" onClick={onEditLabel}>
        <Pencil />
      </ActionBtn>
      <ActionBtn label="付箋を書く" onClick={onEditMemo}>
        <span className="text-base leading-none" aria-hidden>
          📝
        </span>
      </ActionBtn>
      <ActionBtn label="ラベルをコピー" onClick={onCopy}>
        {copied ? <Check /> : <Copy />}
      </ActionBtn>
      <span className="sr-only">{open ? "操作メニュー" : ""}</span>
      <button type="button" className="sr-only" onClick={() => onOpenChange(false)}>
        閉じる
      </button>
    </div>
  );
}

/** 作り直し: 予備があれば即座に。無ければ AI を呼ぶので、使った直後は残り秒数を出して待ってもらう。 */
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
    ? `AI の作り直しは、あと ${seconds} 秒で使えます`
    : spares > 0
      ? `このマスの文だけ作り直す（すぐ出せる候補あと ${spares} 件）`
      : "このマスの文だけ作り直す（AI に頼みます）";
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
