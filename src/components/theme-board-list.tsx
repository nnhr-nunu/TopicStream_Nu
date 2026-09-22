"use client";

import { useEffect, useMemo, useState } from "react";
import { Heart, Search, Share2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CatalogBoard } from "@/lib/catalog-data";
import { loadFavoriteBoardIds, toggleFavoriteBoard } from "@/lib/favorites";
import { cn } from "@/lib/utils";

export function ThemeBoardList({
  initialBoards,
  onImport,
  compact = false,
  busy = false,
}: {
  initialBoards?: CatalogBoard[];
  onImport: (board: CatalogBoard) => void;
  compact?: boolean;
  busy?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [boards, setBoards] = useState<CatalogBoard[]>(initialBoards ?? []);
  const [favorites, setFavorites] = useState<string[]>(() => loadFavoriteBoardIds());
  const [searching, setSearching] = useState(false);
  const [loaded, setLoaded] = useState(Boolean(initialBoards));

  useEffect(() => {
    if (initialBoards) return;
    let cancelled = false;
    void fetch("/api/catalog")
      .then((response) => response.json())
      .then((json: { boards?: CatalogBoard[] }) => {
        if (cancelled) return;
        setBoards(json.boards ?? []);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded(true);
        toast.error("テーマボードを読めませんでした");
      });
    return () => {
      cancelled = true;
    };
  }, [initialBoards]);

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

  return (
    <section id="community" className="w-full scroll-mt-24">
      <label className="relative mb-4 block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => void runSearch(event.target.value)}
          placeholder="テーマ・タグ・キーワードで検索"
          className="h-11 rounded-xl pl-9 bg-card/70"
          aria-label="テーマを検索"
        />
      </label>

      {searching ? <p className="mb-4 text-sm text-muted-foreground">探しています…</p> : null}

      {!loaded ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          みんなのボードを読み込み中…
        </p>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          該当するボードがありません。別の言葉で探してみてください。
        </p>
      ) : (
        <ul className={cn("grid gap-4", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
          {shown.map((board) => {
            const liked = favorites.includes(board.id);
            return (
              <li key={board.id}>
                <Card className="h-full border-border/70 bg-card/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-start justify-between gap-2 text-base">
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
                      disabled={busy}
                    >
                      <Heart className={liked ? "fill-current" : undefined} />
                      {board.favorites}
                    </Button>
                    <Button size="sm" onClick={() => onImport(board)} disabled={busy}>
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
    </section>
  );
}
