"use client";

import { useMemo, useSyncExternalStore } from "react";
import { ArrowRight, Heart } from "lucide-react";
import { toast } from "sonner";

import { BoardActionsProvider } from "@/components/board-actions";
import { BoardCanvas } from "@/components/board-canvas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { loadFavoriteTopics, subscribeTopicFavorites, toggleFavoriteTopic } from "@/lib/favorites";
import { entryPreviewBoard } from "@/lib/topic-preview";
import type { KnowledgeEntry } from "@/lib/topic-knowledge";

const NO_FAVORITES: string[] = [];

/** 選ばれた重みの合計（♡・クリック・ピン・コメントのハート） */
export function entryPicks(entry: KnowledgeEntry): number {
  return Object.values(entry.picks ?? {}).reduce((sum, value) => sum + value, 0);
}

/**
 * トピック図鑑の1つのお題を、見るだけのボード（マンダラート）で開く。
 * みんなが作った話題マップの「見てみる」（CatalogPreviewDialog）と同じ作り: 上に ♡ と「このお題で始める」、カードは読むだけ。
 */
export function TopicPreviewDialog({
  entry,
  busy = false,
  onOpenChange,
  onStart,
}: {
  entry: KnowledgeEntry | null;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (keyword: string) => void;
}) {
  const board = useMemo(() => (entry ? entryPreviewBoard(entry) : null), [entry]);
  const favs = useSyncExternalStore(subscribeTopicFavorites, loadFavoriteTopics, () => NO_FAVORITES);
  const liked = entry ? favs.includes(entry.seed) : false;

  return (
    <Dialog open={Boolean(entry && board)} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100dvh-2rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {entry && board ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3 pr-12">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-base">{entry.seed}</DialogTitle>
                <DialogDescription className="text-xs">見るだけの画面です。始めると自分のマップで広げられます。</DialogDescription>
              </div>
              <Button
                size="sm"
                variant={liked ? "secondary" : "outline"}
                onClick={() => toggleFavoriteTopic(entry.seed)}
                aria-label={liked ? "ハートを外す" : "ハートを付ける"}
              >
                <Heart className={liked ? "fill-current" : undefined} />
                {entryPicks(entry)}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onStart(entry.seed);
                }}
                disabled={busy}
              >
                このお題で始める
                <ArrowRight />
              </Button>
            </div>
            <BoardActionsProvider
              value={{
                expandNode: () => undefined,
                pinNode: () => undefined,
                setMemo: () => undefined,
                copyLabel: async (id) => {
                  const label = board.nodes.find((node) => node.id === id)?.data.label;
                  if (!label) return;
                  try {
                    await navigator.clipboard.writeText(label);
                    toast.success(`「${label}」をコピーしました`);
                  } catch {
                    toast.error("コピーできませんでした");
                  }
                },
                overlay: true,
                viewer: true,
                pinnedNodeId: null,
                focusedNodeId: null,
                generationLayout: "mandala",
              }}
            >
              <div className="relative min-h-0 flex-1" data-layout="mandala">
                <BoardCanvas board={board} overlay layout="mandala" onFocus={() => undefined} />
              </div>
            </BoardActionsProvider>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
