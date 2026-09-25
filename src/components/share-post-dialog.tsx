"use client";

import { CopyIcon, PencilIcon, SparklesIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildShareExample,
  composeSharePost,
  POST_LIMIT,
  SHARE_HASHTAG,
  tweetIntentUrl,
  weightedPostLength,
} from "@/lib/share-post";
import type { Board } from "@/lib/types";

/** X のロゴ。lucide に無いので最小限の SVG を持つ */
export function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function siteUrl(): string {
  if (typeof window === "undefined") return "";
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${window.location.origin}${base}/`;
}

/** 開くたびに最新のボードで作り直すため、呼び出し側で key を変える */
export function SharePostDialog({
  open,
  onOpenChange,
  board,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: Board;
}) {
  // 既定は自由入力。文例は「たたき台」としてボタンで流し込む
  const [body, setBody] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const url = siteUrl();
  const text = composeSharePost(body);
  const remaining = POST_LIMIT - weightedPostLength(text, true);
  const over = remaining < 0;

  function fillExample() {
    setBody(buildShareExample(board));
    requestAnimationFrame(() => bodyRef.current?.focus());
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("リンクをコピーしました");
    } catch {
      toast.message(url);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] grid-cols-1 overflow-y-auto sm:max-w-md [&>*]:min-w-0"
        initialFocus={bodyRef}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XLogo className="size-4" />
            X でシェア
          </DialogTitle>
          <DialogDescription>TopicStream(ぬ) のリンクを付けて、今日の雑談ネタを投稿できます。</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-xs font-medium text-primary">
              <PencilIcon className="size-3" aria-hidden />
              投稿する文章（自由入力）
            </span>
            <Button type="button" size="xs" variant="ghost" onClick={fillExample}>
              <SparklesIcon />
              文例を入れる
            </Button>
          </div>
          <textarea
            ref={bodyRef}
            aria-label="投稿する文章"
            className="field-sizing-content min-h-24 w-full resize-none rounded-lg border border-dashed border-primary/50 bg-primary/5 px-2.5 py-2 text-[15px] leading-relaxed transition-colors outline-none placeholder:text-muted-foreground/80 focus:border-solid focus:border-primary focus:bg-transparent focus:ring-3 focus:ring-primary/15"
            placeholder="ひとこと添えてください（空欄でも投稿できます）"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <p className="text-[15px] text-primary">{SHARE_HASHTAG}</p>
          <p className="truncate text-sm text-primary">{url.replace(/^https?:\/\//, "")}</p>
          <p
            className={`text-right text-xs tabular-nums ${over ? "font-medium text-destructive" : "text-muted-foreground"}`}
          >
            {over ? `文字数オーバー ${remaining}` : `残り ${remaining}`}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => void copyLink()}>
            <CopyIcon />
            リンクをコピー
          </Button>
          <Button
            type="button"
            disabled={over}
            onClick={() => window.open(tweetIntentUrl(text, url), "_blank", "noopener,noreferrer")}
          >
            <XLogo className="size-3.5" />
            X でポスト
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
