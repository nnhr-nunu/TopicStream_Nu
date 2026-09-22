"use client";

import Link from "next/link";

import { ThemeBoardList } from "@/components/theme-board-list";
import { Button } from "@/components/ui/button";
import { catalogBoardToBoard, type CatalogBoard } from "@/lib/catalog-data";
import { getBoardSnapshot, writeBoardSnapshot } from "@/lib/board-store";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function CommunityCatalog({ initialBoards }: { initialBoards: CatalogBoard[] }) {
  const router = useRouter();

  function importBoard(board: CatalogBoard) {
    const snapshot = getBoardSnapshot();
    const next = catalogBoardToBoard(board);
    writeBoardSnapshot({
      ...snapshot,
      boards: [...snapshot.boards, next],
      activeBoardId: next.id,
    });
    toast.success(`「${board.name}」を自分のボードに取り込みました`);
    router.push("/");
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.22em] text-primary">みんなのトークテーマボード</p>
          <h1 className="mt-1 text-2xl font-semibold">ホームと同じカタログです</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            キーワード検索とテーマ選びはスタート画面にまとまっています。ここからも同じボードを取り込めます。
          </p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          配信ホームへ
        </Button>
      </header>
      <ThemeBoardList initialBoards={initialBoards} onImport={importBoard} />
    </div>
  );
}
