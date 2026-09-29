"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Clock, Copy, Eye, Search } from "lucide-react";

import { CatalogPreviewDialog } from "@/components/catalog-preview-dialog";
import { HeartButton } from "@/components/heart-button";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { catalogRoot, catalogStats, searchCatalog, type CatalogBoard } from "@/lib/catalog-data";
import { loadFavoriteBoardIds, toggleFavoriteBoard } from "@/lib/favorites";
import { cn } from "@/lib/utils";

export function ThemeBoardList({
  initialBoards,
  onImport,
  onStart,
  compact = false,
  busy = false,
  critterSkip,
}: {
  initialBoards?: CatalogBoard[];
  /** ボードを丸ごと自分のボードに写す */
  onImport: (board: CatalogBoard) => void;
  /** 真ん中のお題だけ使って、新しく始める */
  onStart: (keyword: string) => void;
  compact?: boolean;
  busy?: boolean;
  /** この一覧に遊びに来させない動物（空白区切り。トップでは動きの大きいカエルを外す） */
  critterSkip?: string;
}) {
  const [query, setQuery] = useState("");
  const [boards, setBoards] = useState<CatalogBoard[]>(initialBoards ?? []);
  const [favorites, setFavorites] = useState<string[]>(() => loadFavoriteBoardIds());
  const [searching, setSearching] = useState(false);
  // コピーする前に見るだけの画面で開いているボード（♡ の数が変わっても追えるよう id で持つ）
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewing = boards.find((board) => board.id === previewId) ?? null;
  const [loaded, setLoaded] = useState(Boolean(initialBoards));
  // 検索前の件数。0 件なら検索欄を隠し、「これから増えます」の案内だけ出す
  const [total, setTotal] = useState(initialBoards?.length ?? 0);
  /** 絞り込む前の全件（サーバーに聞けないときは、ここから探す） */
  const allBoards = useRef<CatalogBoard[]>(initialBoards ?? []);
  /** 最後に打った検索だけを画面に出す（遅れて届いた古い検索の答えで上書きしない） */
  const searchSeq = useRef(0);
  /** ボードごとの最後の ♡ 操作。続けて押したとき、前の操作の返事で数を戻さない */
  const favoriteSeq = useRef(new Map<string, number>());

  useEffect(() => {
    if (initialBoards) return;
    let cancelled = false;
    void fetch("/api/catalog")
      .then((response) => response.json())
      .then((json: { boards?: CatalogBoard[] }) => {
        if (cancelled) return;
        setBoards(json.boards ?? []);
        allBoards.current = json.boards ?? [];
        setTotal(json.boards?.length ?? 0);
        setLoaded(true);
      })
      .catch(() => {
        // GitHub Pages のようにサーバーが無いときは、空の案内を出す
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initialBoards]);

  // 並びはサーバーの順（ちゃんと使われている・新しいボードが上）
  const shown = boards;

  async function runSearch(value: string) {
    setQuery(value);
    const seq = ++searchSeq.current;
    setSearching(true);
    // 打っている途中の 1 文字ごとには聞かない
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    if (seq !== searchSeq.current) return;
    try {
      const response = await fetch(`/api/catalog?q=${encodeURIComponent(value)}`);
      if (!response.ok) throw new Error("catalog");
      const json = (await response.json()) as { boards: CatalogBoard[] };
      if (seq === searchSeq.current) setBoards(json.boards);
    } catch {
      if (seq === searchSeq.current) setBoards(searchCatalog(allBoards.current, value));
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  }

  function setFavoriteCount(id: string, count: (current: number) => number) {
    const patch = (list: CatalogBoard[]) =>
      list.map((item) => (item.id === id ? { ...item, favorites: Math.max(0, count(item.favorites)) } : item));
    setBoards(patch);
    allBoards.current = patch(allBoards.current);
  }

  async function favorite(board: CatalogBoard) {
    const result = toggleFavoriteBoard(board.id);
    setFavorites(result.ids);
    // サーバーの返事（数百ミリ秒〜）を待たずに数を動かし、返ってきた数で合わせ直す
    setFavoriteCount(board.id, (current) => current + (result.added ? 1 : -1));
    const seq = (favoriteSeq.current.get(board.id) ?? 0) + 1;
    favoriteSeq.current.set(board.id, seq);
    try {
      const response = await fetch("/api/catalog/favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: board.id, undo: !result.added }),
      });
      if (!response.ok) return;
      const json = (await response.json()) as { favorites: number };
      if (favoriteSeq.current.get(board.id) === seq) setFavoriteCount(board.id, () => json.favorites);
    } catch {
      // サーバーが無い（GitHub Pages）ときは、手元の見た目だけ変える
    }
  }

  return (
    <section id="community" className="w-full scroll-mt-24">
      {loaded && total === 0 ? null : (
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
      )}

      {searching ? <p className="mb-4 text-sm text-muted-foreground">探しています…</p> : null}

      {!loaded ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          みんなのボードを読み込み中…
        </p>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm font-medium">まだテーマボードはありません</p>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            これから増えていきます。まずはお題を入れて、自分の話題マップを作ってみてください。
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          該当するボードがありません。別の言葉で探してみてください。
        </p>
      ) : (
        <ul className={cn("relative grid gap-4", compact ? "grid-cols-1" : "sm:grid-cols-2")} data-critter-garden data-critter-skip={critterSkip}>
          {shown.map((board) => {
            const liked = favorites.includes(board.id);
            const stats = catalogStats(board);
            return (
              <li key={board.id}>
                <Card className="h-full border-border/70 bg-card/80 shadow-sm" data-critter-perch>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold break-words">{board.name}</CardTitle>
                    <CardAction>
                      <HeartButton liked={liked} count={board.favorites} onToggle={() => void favorite(board)} disabled={busy} />
                    </CardAction>
                    <CardDescription className="flex flex-wrap items-center gap-x-1.5 text-[11px]">
                      {board.tags.length > 0 ? (
                        <>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" aria-label="最後に使われた時期" />
                            {board.tags.join(" / ")}
                          </span>
                          <span aria-hidden>·</span>
                        </>
                      ) : null}
                      <span>全{stats.cards}カード</span>
                      <span aria-hidden>·</span>
                      <span>{stats.expanded}回展開</span>
                    </CardDescription>
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
                    <Button size="sm" onClick={() => setPreviewId(board.id)}>
                      <Eye />
                      見てみる
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onStart(catalogRoot(board))} disabled={busy}>
                      このお題で始める
                      <ArrowRight />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onImport(board)} disabled={busy} title="広げたところまで丸ごと、自分のボードに写します">
                      <Copy />
                      コピーして使う
                    </Button>
                  </CardFooter>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <CatalogPreviewDialog
        board={previewing}
        liked={previewing ? favorites.includes(previewing.id) : false}
        busy={busy}
        onOpenChange={(open) => {
          if (!open) setPreviewId(null);
        }}
        onFavorite={(board) => void favorite(board)}
        onImport={(board) => {
          setPreviewId(null);
          onImport(board);
        }}
        onStart={(board) => {
          setPreviewId(null);
          onStart(catalogRoot(board));
        }}
      />
    </section>
  );
}
