"use client";

import { useState } from "react";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>📝 {title || "付箋"}</DialogTitle>
          <DialogDescription>
            {readOnly ? "配信メモです。マスの大きさは変わりません。" : "書き終わるまで確定しません。完了で残します。"}
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
              <Button
                type="button"
                onClick={() => {
                  onCommit(draft);
                  onOpenChange(false);
                }}
              >
                完了
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
