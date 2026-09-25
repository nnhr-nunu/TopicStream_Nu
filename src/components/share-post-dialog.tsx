"use client";

import { CopyIcon, DownloadIcon, ImageIcon, PencilIcon, Share2Icon, SparklesIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { buildTopicTrail } from "@/lib/topic-trail";
import { renderTrailImage, type TrailImageMode } from "@/lib/trail-image";
import type { Board } from "@/lib/types";
import { cn } from "@/lib/utils";

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

const TRAIL_MODES: { value: TrailImageMode; label: string }[] = [
  { value: "trail", label: "選んだ話題だけ" },
  { value: "map", label: "マップ全体" },
];

function imageFileName(board: Board, mode: TrailImageMode): string {
  const safe = board.name.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40) || "board";
  return `topicstream-${mode === "trail" ? "trail" : "map"}-${safe}.png`;
}

/**
 * 話題の軌跡を画像にして、保存・コピー・（スマホなら）共有する。
 * X の投稿画面（intent）には画像を添付できないので、コピーして貼るか保存して添付してもらう。
 */
function TrailImagePanel({ board, open }: { board: Board; open: boolean }) {
  const steps = useMemo(() => buildTopicTrail(board).steps, [board]);
  // 2回以上広げていれば「たどった道」の方が伝わる。1回だけならマップ全体の方が見栄えがする
  const [mode, setMode] = useState<TrailImageMode>(steps >= 2 ? "trail" : "map");
  const [image, setImage] = useState<{ mode: TrailImageMode; blob: Blob; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const ready = image?.mode === mode ? image : null;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let url = "";
    renderTrailImage(board, mode)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setImage({ mode, blob, url });
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [board, mode, open]);

  const file = ready ? new File([ready.blob], imageFileName(board, mode), { type: "image/png" }) : null;
  const canShareFile =
    typeof navigator !== "undefined" && Boolean(file && navigator.canShare?.({ files: [file] }));
  const canCopy = typeof window !== "undefined" && "ClipboardItem" in window;

  function save() {
    if (!ready) return;
    const anchor = document.createElement("a");
    anchor.href = ready.url;
    anchor.download = imageFileName(board, mode);
    anchor.click();
  }

  async function copy() {
    if (!ready) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": ready.blob })]);
      toast.success("画像をコピーしました", { description: "X の投稿画面で貼り付け（Ctrl+V）できます" });
    } catch {
      toast.error("コピーできませんでした。保存してから添付してください");
    }
  }

  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text: SHARE_HASHTAG });
    } catch {
      /* 閉じただけ */
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs font-medium text-primary">
          <ImageIcon className="size-3" aria-hidden />
          話題の軌跡を画像にする
        </span>
        <div role="radiogroup" aria-label="画像の種類" className="flex rounded-lg border border-border p-0.5">
          {TRAIL_MODES.map((item) => (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={mode === item.value}
              className={cn(
                "rounded-md px-2 py-0.5 text-xs transition-colors",
                mode === item.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setMode(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-h-32 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-muted/40">
        {ready ? (
          // eslint-disable-next-line @next/next/no-img-element -- その場で作った blob の画像
          <img src={ready.url} alt={`${mode === "trail" ? "選んだ話題" : "マップ全体"}の画像`} className="max-h-64 w-full object-contain" />
        ) : (
          <p className="text-xs text-muted-foreground">{failed ? "画像を作れませんでした" : "画像を作っています…"}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="flex-1" disabled={!ready} onClick={save}>
          <DownloadIcon />
          保存
        </Button>
        {canCopy ? (
          <Button type="button" size="sm" variant="outline" className="flex-1" disabled={!ready} onClick={() => void copy()}>
            <CopyIcon />
            コピー
          </Button>
        ) : null}
        {canShareFile ? (
          <Button type="button" size="sm" variant="outline" className="flex-1" disabled={!ready} onClick={() => void share()}>
            <Share2Icon />
            共有
          </Button>
        ) : null}
      </div>
      <p className="text-[11px] leading-4 text-muted-foreground">
        X の投稿画面には自動で付かないので、コピーして貼り付けるか、保存した画像を添付してください。
      </p>
    </div>
  );
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
        className="max-h-[calc(100dvh-2rem)] grid-cols-1 overflow-y-auto sm:max-w-lg [&>*]:min-w-0"
        initialFocus={bodyRef}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XLogo className="size-4" />
            X でシェア
          </DialogTitle>
          <DialogDescription>
            「{board.name}」の話題を、TopicStream(ぬ) のリンクと画像を付けて投稿できます。
          </DialogDescription>
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

        <TrailImagePanel board={board} open={open} />

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
