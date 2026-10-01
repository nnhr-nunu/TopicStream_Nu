"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isPublicSafe } from "@/lib/public-text";
import { cleanStreamerName, STREAMER_NAME_MAX } from "@/lib/stream-directory";
import { cn } from "@/lib/utils";

/**
 * 配信者名を ✏️ からその場で直す（配信と連携の欄・ホームの配信一覧の自分の行）。
 * 見る画面は視聴者の画面なので、ここには出さない。空にして保存すると、配信 URL から分かる名前に戻る。
 */
export function StreamerNameEditor({
  name,
  autoName,
  onChange,
  className,
}: {
  name: string;
  /** 配信 URL から分かる名前（空にしたときに戻る名前） */
  autoName: string;
  onChange: (name: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState("");
  const close = () => {
    setEditing(false);
    setError("");
  };

  if (!editing) {
    return (
      <span className={cn("inline-flex min-w-0 max-w-full items-center gap-0.5", className)}>
        <span className="truncate">{name || autoName || "未設定"}</span>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="配信者名を変更"
          title="配信者名を変更"
          onClick={() => {
            setDraft(name || autoName);
            setEditing(true);
          }}
        >
          <Pencil />
        </Button>
      </span>
    );
  }

  return (
    <form
      className={cn("flex min-w-0 flex-1 flex-col gap-1", className)}
      onSubmit={(event) => {
        event.preventDefault();
        const next = cleanStreamerName(draft);
        // 一覧はみんなに見えるので、ほかの公開の場所と同じフィルタを通す（サーバーでも通す）
        if (next && !isPublicSafe(next)) {
          setError("この名前は出せません。連絡先・URL・人を傷つける言葉は入れないでください。");
          return;
        }
        onChange(next);
        close();
      }}
    >
      <span className="flex items-center gap-1">
        <Input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
          maxLength={STREAMER_NAME_MAX}
          autoFocus
          aria-label="配信者名"
          aria-invalid={error ? true : undefined}
          placeholder={autoName || "配信者名"}
          className="h-8 text-xs"
        />
        <Button type="submit" size="icon-sm" aria-label="名前を保存" title="名前を保存">
          <Check />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="やめる" title="やめる" onClick={close}>
          <X />
        </Button>
      </span>
      {error ? (
        <span role="alert" className="text-[11px] leading-4 text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}
