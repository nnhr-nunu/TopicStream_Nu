"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ArrowRight, Heart } from "lucide-react";
import { toast } from "sonner";

import { BoardActionsProvider } from "@/components/board-actions";
import { BoardCanvas } from "@/components/board-canvas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { loadFavoriteTopics, subscribeTopicFavorites, toggleFavoriteTopic } from "@/lib/favorites";
import { noteTopicPick } from "@/lib/knowledge-client";
import { entryPreviewBoard } from "@/lib/topic-preview";
import type { KnowledgeEntry } from "@/lib/topic-knowledge";

const NO_FAVORITES: string[] = [];

/**
 * トピック図鑑の1つのお題を、見るだけのボードで開く。カードを選んで ♡ を付けると図鑑に「選ばれた」と伝わり、
 * 次からその語が上に出やすくなる。気に入ったらこのお題で始められる。
 */
export function TopicPreviewDialog({
  entry,
  busy = false,
  startFromTopic = true,
  onOpenChange,
  onStart,
}: {
  entry: KnowledgeEntry | null;
  busy?: boolean;
  /** 選んだカードの語から始められるようにする（false ならいつもお題から） */
  startFromTopic?: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (keyword: string) => void;
}) {
  const board = useMemo(() => (entry ? entryPreviewBoard(entry) : null), [entry]);
  const [focus, setFocus] = useState<string | null>(null);
  const favs = useSyncExternalStore(subscribeTopicFavorites, loadFavoriteTopics, () => NO_FAVORITES);
  const focusedNode = board?.nodes.find((node) => node.id === focus && node.data.parentId !== null);
  const focusedLabel = focusedNode?.data.label;
  const liked = focusedLabel ? favs.includes(focusedLabel) : false;

  function heart() {
    if (!entry || !focusedLabel) return;
    toggleFavoriteTopic(focusedLabel);
    if (liked) return;
    noteTopicPick(entry.seed, focusedLabel, "heart", entry.mode ?? "chat");
    toast.success(`「${focusedLabel}」にハートを付けました`, { description: "お気に入りに残り、図鑑でも上に出やすくなります。" });
  }

  return (
    <Dialog
      open={Boolean(entry && board)}
      onOpenChange={(open) => {
        if (!open) setFocus(null);
        onOpenChange(open);
      }}
    >
      <DialogContent className="flex h-[calc(100dvh-2rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        {entry && board ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3 pr-12">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-base">{entry.seed}</DialogTitle>
                <DialogDescription className="text-xs">
                  {focusedLabel ? `「${focusedLabel}」を選んでいます` : "カードを選ぶと ♡ を付けられます"}
                </DialogDescription>
              </div>
              <Button
                size="sm"
                variant={liked ? "secondary" : "outline"}
                onClick={heart}
                disabled={!focusedLabel}
                aria-label={liked ? "ハートを外す" : "選んだカードにハートを付ける"}
              >
                <Heart className={liked ? "fill-current" : undefined} />
                ハート
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onStart(startFromTopic && focusedLabel ? focusedLabel : entry.seed);
                }}
                disabled={busy}
              >
                {startFromTopic && focusedLabel ? "この話題で始める" : "このお題で始める"}
                <ArrowRight />
              </Button>
            </div>
            <BoardActionsProvider
              value={{
                // 見るだけの画面なので、カードのタップ（ふだんは広げる）は「選ぶ」にする
                expandNode: (id) => setFocus(id),
                pinNode: () => undefined,
                setMemo: () => undefined,
                copyLabel: async (id) => {
                  const label = board.nodes.find((node) => node.id === id)?.data.label;
                  if (!label) return;
                  await navigator.clipboard.writeText(label);
                  toast.success(`「${label}」をコピーしました`);
                },
                overlay: true,
                viewer: true,
                pinnedNodeId: null,
                focusedNodeId: focus,
                generationLayout: "radial",
              }}
            >
              <div className="relative min-h-0 flex-1" data-layout="radial">
                <BoardCanvas board={{ ...board, focusedNodeId: focus }} overlay layout="radial" onFocus={setFocus} />
              </div>
            </BoardActionsProvider>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
