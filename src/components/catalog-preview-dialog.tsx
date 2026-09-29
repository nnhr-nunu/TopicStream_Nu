"use client";

import { useMemo } from "react";
import { Heart, Share2 } from "lucide-react";
import { toast } from "sonner";

import { BoardActionsProvider } from "@/components/board-actions";
import { BoardCanvas } from "@/components/board-canvas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { catalogBoardToBoard, type CatalogBoard } from "@/lib/catalog-data";
import { layoutBoard, prefsFromSettings } from "@/lib/layout";
import type { GenerationLayout } from "@/lib/types";

/**
 * みんなのトークテーマを取り込む前に見るだけの画面。カードは読むだけ（広げる・書き直すはできない）。
 * ここから ♡ を付けたり、気に入ったら取り込んだりできる。
 */
export function CatalogPreviewDialog({
  board,
  liked,
  busy = false,
  onOpenChange,
  onFavorite,
  onImport,
}: {
  board: CatalogBoard | null;
  liked: boolean;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onFavorite: (board: CatalogBoard) => void;
  onImport: (board: CatalogBoard) => void;
}) {
  const preview = useMemo(() => {
    if (!board) return null;
    const converted = catalogBoardToBoard(board);
    const layout: GenerationLayout = converted.nodes.some((node) => typeof node.data.groupId === "number")
      ? "mandala"
      : "radial";
    // いっしょに見る画面と同じく、見る側の標準の大きさで並べ直す
    const laidOut = layoutBoard(
      converted,
      prefsFromSettings({ density: "comfortable", fontScale: 1, generationLayout: layout }, false, converted.pinnedNodeId),
    );
    // ♡ で一覧が読み直されても同じボードとして扱う（id が変わると拡大・位置が戻ってしまう）
    return { board: { ...laidOut, id: `preview-${board.id}`, pinnedNodeId: null }, layout };
  }, [board]);

  return (
    <Dialog open={Boolean(board)} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100dvh-2rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {board && preview ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3 pr-12">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-base">{board.name}</DialogTitle>
                <DialogDescription className="text-xs">見るだけの画面です。取り込むと自分のボードで広げられます。</DialogDescription>
              </div>
              <Button
                size="sm"
                variant={liked ? "secondary" : "outline"}
                onClick={() => onFavorite(board)}
                disabled={busy}
                aria-label={liked ? "ハートを外す" : "ハートを付ける"}
              >
                <Heart className={liked ? "fill-current" : undefined} />
                {board.favorites}
              </Button>
              <Button size="sm" onClick={() => onImport(board)} disabled={busy}>
                <Share2 />
                取り込む
              </Button>
            </div>
            <BoardActionsProvider
              value={{
                expandNode: () => undefined,
                pinNode: () => undefined,
                setMemo: () => undefined,
                copyLabel: async (id) => {
                  const label = preview.board.nodes.find((node) => node.id === id)?.data.label;
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
                generationLayout: preview.layout,
              }}
            >
              <div className="relative min-h-0 flex-1" data-layout={preview.layout}>
                <BoardCanvas
                  board={preview.board}
                  overlay
                  layout={preview.layout}
                  onFocus={() => undefined}
                />
              </div>
            </BoardActionsProvider>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
