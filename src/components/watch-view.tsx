"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Copy, Heart } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { BoardActionsProvider } from "@/components/board-actions";
import { BoardCanvas } from "@/components/board-canvas";
import { Button } from "@/components/ui/button";
import { loadFavoriteTopics, subscribeTopicFavorites, toggleFavoriteTopic } from "@/lib/favorites";
import type { Board } from "@/lib/types";

export function WatchView({ shareId }: { shareId: string }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [localFocus, setLocalFocus] = useState<string | null>(null);
  const favs = useSyncExternalStore(
    subscribeTopicFavorites,
    loadFavoriteTopics,
    (): string[] => [],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!shareId) {
        if (!cancelled) setError("共有IDがありません。配信者のリンクから開き直してください。");
        return;
      }
      const response = await fetch(`/api/share/${shareId}`, { cache: "no-store" });
      if (!response.ok) {
        if (!cancelled) setError("この共有リンクは見つかりません。配信者がまだ公開していないか、サーバーが再起動した可能性があります。");
        return;
      }
      const json = (await response.json()) as { board: Board; nickname: string };
      if (!cancelled) {
        setBoard(json.board);
        setNickname(json.nickname);
        setError(null);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [shareId]);

  if (error) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="max-w-md text-sm leading-6 text-muted-foreground">{error}</p>
        <Button nativeButton={false} render={<Link href="/" />}>
          自分のマップを開く
        </Button>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
        いっしょに見る画面を読み込み中…
      </div>
    );
  }

  const viewBoard = {
    ...board,
    focusedNodeId: localFocus ?? board.focusedNodeId,
  };
  const focused = viewBoard.focusedNodeId ?? viewBoard.pinnedNodeId;
  const focusedLabel = viewBoard.nodes.find((node) => node.id === focused)?.data.label;

  return (
    <BoardActionsProvider
      value={{
        expandNode: () => undefined,
        pinNode: () => undefined,
        setMemo: () => undefined,
        copyLabel: async (id) => {
          const label = viewBoard.nodes.find((node) => node.id === id)?.data.label;
          if (!label) return;
          await navigator.clipboard.writeText(label);
          toast.success(`「${label}」をコピーしました`);
        },
        overlay: true,
        pinnedNodeId: board.pinnedNodeId,
        focusedNodeId: viewBoard.focusedNodeId,
      }}
    >
      <div className="relative h-svh overflow-hidden">
        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-between gap-3 p-3">
          <div className="pointer-events-auto rounded-2xl border border-border/70 bg-background/75 px-3 py-2 backdrop-blur-md">
            <p className="text-[10px] tracking-[0.2em] text-primary">いっしょに見ている</p>
            <p className="text-sm font-medium">{board.name}</p>
            {nickname ? <p className="text-[11px] text-muted-foreground">{nickname} の枠</p> : null}
          </div>
          <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-border/70 bg-background/75 p-1 backdrop-blur-md">
            <Button
              size="sm"
              variant="ghost"
              disabled={!focusedLabel}
              onClick={async () => {
                if (!focusedLabel) return;
                await navigator.clipboard.writeText(focusedLabel);
                toast.success("コピーしました");
              }}
            >
              <Copy />
              コピー
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!focusedLabel}
              onClick={() => {
                if (!focusedLabel) return;
                toggleFavoriteTopic(focusedLabel);
                toast.success("お気に入りに残しました");
              }}
            >
              <Heart className={focusedLabel && favs.includes(focusedLabel) ? "fill-current" : undefined} />
              お気に入り
            </Button>
          </div>
        </header>
        <BoardCanvas board={viewBoard} overlay onFocus={setLocalFocus} onPositions={() => undefined} />
      </div>
    </BoardActionsProvider>
  );
}
