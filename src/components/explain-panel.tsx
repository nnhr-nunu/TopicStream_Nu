"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ExplainResult } from "@/lib/explain-client";

/** 「これって何？」: カードの言葉の短い解説。付箋に貼ればカンペとして残る */
export function ExplainPanel({
  open,
  label,
  onOpenChange,
  explain,
  onAttach,
}: {
  open: boolean;
  label: string;
  onOpenChange: (open: boolean) => void;
  explain: () => Promise<ExplainResult>;
  onAttach: (text: string) => void;
}) {
  const [result, setResult] = useState<ExplainResult | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void explain().then((next) => {
      if (live) setResult(next);
    });
    return () => {
      live = false;
      setResult(null);
    };
    // 開いたときに 1 回だけ（explain は描画ごとに作り直される）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, label]);

  const searchUrl = result ? `https://www.google.com/search?q=${encodeURIComponent(result.query)}` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton finalFocus={false}>
        <DialogHeader>
          <DialogTitle className="break-words">これって何？「{label}」</DialogTitle>
          <DialogDescription className="sr-only">カードの言葉の短い解説</DialogDescription>
        </DialogHeader>
        {!result ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            調べています…
          </p>
        ) : (
          <div className="space-y-2" role="status">
            {result.text ? (
              <p className="text-sm leading-7">{result.text}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {result.warning ?? "AI を使えないので、ここでは解説を出せません。"}検索で調べられます。
              </p>
            )}
            {result.text && result.warning ? <p className="text-xs text-muted-foreground">{result.warning}</p> : null}
            {result.source === "gemini" ? (
              <p className="text-xs text-muted-foreground">AI の解説なので、まちがうこともあります。</p>
            ) : null}
          </div>
        )}
        <DialogFooter>
          {result ? (
            <Button
              variant="ghost"
              nativeButton={false}
              render={<a href={searchUrl} target="_blank" rel="noopener noreferrer" />}
            >
              調べる
              <ExternalLink aria-hidden />
            </Button>
          ) : null}
          {result?.text ? (
            <Button
              type="button"
              onClick={() => {
                onAttach(result.text);
                onOpenChange(false);
              }}
            >
              📝 付箋に貼る
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              閉じる
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
