"use client";

import { useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MEMO_MAX } from "@/lib/constants";

export function StickyNotePanel({
  open,
  title,
  value,
  readOnly = false,
  onOpenChange,
  onCommit,
}: {
  open: boolean;
  title: string;
  value: string;
  readOnly?: boolean;
  onOpenChange: (open: boolean) => void;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState({ open, value });
  if (open !== seen.open || value !== seen.value) {
    setSeen({ open, value });
    if (open) setDraft(value);
  }

  function commit() {
    onCommit(draft);
    onOpenChange(false);
  }

  /** Enter で完了。Shift+Enter・Ctrl+Enter で改行（日本語の変換中の Enter は確定に使わない） */
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!event.ctrlKey && !event.metaKey) {
      commit();
      return;
    }
    const target = event.currentTarget;
    const { selectionStart, selectionEnd } = target;
    const next = `${draft.slice(0, selectionStart)}\n${draft.slice(selectionEnd)}`;
    if (next.length > MEMO_MAX) return;
    setDraft(next);
    requestAnimationFrame(() => target.setSelectionRange(selectionStart + 1, selectionStart + 1));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 閉じたときにカードのメニューへフォーカスを戻さない（メニューが開いたまま残るため） */}
      <DialogContent className="sm:max-w-md" showCloseButton finalFocus={false}>
        <DialogHeader>
          <DialogTitle>📝 {title || "付箋"}</DialogTitle>
          <DialogDescription>
            {readOnly
              ? "配信メモです。マスの大きさは変わりません。"
              : "自分用のメモです（トピック図鑑・みんなのトークテーマには送りません）。Enter で完了、Shift+Enter で改行。"}
          </DialogDescription>
        </DialogHeader>
        {readOnly ? (
          <p className="whitespace-pre-wrap text-sm leading-6">{value || "メモはまだありません"}</p>
        ) : (
          <Textarea
            value={draft}
            maxLength={MEMO_MAX}
            placeholder="エピソード、オチ、リスナーの反応…"
            className="min-h-28"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
          />
        )}
        <DialogFooter>
          {readOnly ? (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              閉じる
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                やめる
              </Button>
              <Button type="button" onClick={commit}>
                完了
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
