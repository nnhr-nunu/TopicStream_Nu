"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy, Expand, Pencil, Pin, RefreshCw } from "lucide-react";

import { StickyNoteIcon } from "@/components/sticky-note-icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LABEL_EDIT_MAX, MEMO_MAX } from "@/lib/constants";
import { cn } from "@/lib/utils";

const LEAVE_MS = 480;

export function TopicActionsMenu({
  open,
  onOpenChange,
  isPinned,
  canExpand,
  copied,
  onExpand,
  onPin,
  onRegenerate,
  onCopy,
  onEditLabel,
  onEditMemo,
  onPointerEnter,
  onPointerLeave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPinned: boolean;
  canExpand: boolean;
  copied: boolean;
  onExpand: () => void;
  onPin: () => void;
  onRegenerate: () => void;
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
      <ActionBtn label="広げる" onClick={onExpand} disabled={!canExpand}>
        <Expand />
      </ActionBtn>
      <ActionBtn label={isPinned ? "ピンを外す" : "いま話している"} onClick={onPin}>
        <Pin className={cn(isPinned && "fill-current")} />
      </ActionBtn>
      <ActionBtn label="再生成" onClick={onRegenerate}>
        <RefreshCw />
      </ActionBtn>
      <ActionBtn label="文を直す" onClick={onEditLabel}>
        <Pencil />
      </ActionBtn>
      <ActionBtn label="付箋を書く" onClick={onEditMemo}>
        <StickyNoteIcon className="size-4" />
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
      className="topic-editor nodrag nowheel nopan nopan"
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
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && event.currentTarget.parentElement?.contains(next)) return;
          finish();
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
