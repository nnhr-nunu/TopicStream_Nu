"use client";

import { useMemo, useState } from "react";
import { Heart, Search, Share2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { catalogBoardToBoard, type CatalogBoard } from "@/lib/catalog-data";
import { loadFavoriteBoardIds, toggleFavoriteBoard } from "@/lib/favorites";
import { getBoardSnapshot, writeBoardSnapshot } from "@/lib/board-store";

export function CommunityCatalog({ initialBoards }: { initialBoards: CatalogBoard[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [boards, setBoards] = useState(initialBoards);
  const [favorites, setFavorites] = useState<string[]>(() => loadFavoriteBoardIds());
  const [searching, setSearching] = useState(false);

  const shown = useMemo(
    () => [...boards].sort((a, b) => b.favorites - a.favorites),
    [boards],
  );

  async function runSearch(value: string) {
    setQuery(value);
    setSearching(true);
    try {
      const response = await fetch(`/api/catalog?q=${encodeURIComponent(value)}`);
      const json = (await response.json()) as { boards: CatalogBoard[] };
      setBoards(json.boards);
    } catch {
      toast.error("検索できませんでした");
    } finally {
      setSearching(false);
    }
  }

  async function favorite(board: CatalogBoard) {
    const result = toggleFavoriteBoard(board.id);
    setFavorites(result.ids);
    if (result.added) {
      const response = await fetch("/api/catalog/favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: board.id }),
      });
      if (response.ok) {
        const json = (await response.json()) as { favorites: number };
        setBoards((current) =>
          current.map((item) => (item.id === board.id ? { ...item, favorites: json.favorites } : item)),
        );
      }
    }
  }

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
          <h1 className="mt-1 text-2xl font-semibold">お気に入りの多いテーマから探す</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            配信で使いやすいボードを検索して、自分のボードへ取り込めます。自分の雑談枠はこれまでどおりこの端末だけに残ります。
          </p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          自分のマップへ戻る
        </Button>
      </header>

      <label className="relative mb-6 block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => void runSearch(event.target.value)}
          placeholder="テーマ・タグ・キーワードで検索"
          className="h-11 rounded-xl pl-9"
          aria-label="テーマを検索"
        />
      </label>

      {searching ? <p className="mb-4 text-sm text-muted-foreground">探しています…</p> : null}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          該当するボードがありません。別の言葉で探してみてください。
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {shown.map((board) => {
            const liked = favorites.includes(board.id);
            return (
              <li key={board.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-start justify-between gap-2">
                      <span>{board.name}</span>
                      <span className="text-xs font-normal text-muted-foreground">{board.author}</span>
                    </CardTitle>
                    <CardDescription>{board.summary}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-1.5">
                    {board.keywords.slice(0, 6).map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {keyword}
                      </span>
                    ))}
                  </CardContent>
                  <CardFooter className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={liked ? "secondary" : "outline"}
                      onClick={() => void favorite(board)}
                    >
                      <Heart className={liked ? "fill-current" : undefined} />
                      {board.favorites}
                    </Button>
                    <Button size="sm" onClick={() => importBoard(board)}>
                      <Share2 />
                      取り込む
                    </Button>
                    <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Users className="size-3.5" />
                      {board.tags.join(" / ")}
                    </span>
                  </CardFooter>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
