"use client";

import { AdSlot } from "@/components/ad-slot";
import { BrandMark } from "@/components/brand-mark";
import { SiteLinks } from "@/components/site-links";
import { ThemeBoardList } from "@/components/theme-board-list";
import { catalogBoardToBoard, type CatalogBoard } from "@/lib/catalog-data";
import { getBoardSnapshot, requestOpenActiveBoard, requestStartKeyword, writeBoardSnapshot } from "@/lib/board-store";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function CommunityCatalog() {
  const router = useRouter();

  function importBoard(board: CatalogBoard) {
    const snapshot = getBoardSnapshot();
    const next = catalogBoardToBoard(board);
    writeBoardSnapshot({
      ...snapshot,
      boards: [...snapshot.boards, next],
      activeBoardId: next.id,
    });
    toast.success(`「${board.name}」をコピーしました`, { description: "自分のボードとして、続きから広げられます" });
    requestOpenActiveBoard();
    router.push("/");
  }

  function startBoard(keyword: string) {
    requestStartKeyword(keyword);
    router.push("/");
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col px-4 py-8">
      <header className="mb-6">
        <BrandMark onHome={() => router.push("/")} />
        <h1 className="mt-4 text-2xl font-semibold">みんなが作った話題マップ</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          よく使われた順に並びます。「このマップを使う」で、広げたところから続けられます。
        </p>
      </header>
      <ThemeBoardList onImport={importBoard} onStart={startBoard} />
      <div className="mt-10">
        <AdSlot />
      </div>
      <SiteLinks className="mt-2" />
    </div>
  );
}
