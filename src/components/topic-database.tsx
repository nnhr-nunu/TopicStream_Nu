"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AdSlot } from "@/components/ad-slot";
import { BrandMark } from "@/components/brand-mark";
import { SiteLinks } from "@/components/site-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBoardSnapshot, writeBoardSnapshot } from "@/lib/board-store";
import { boardFromTopics } from "@/lib/catalog-data";
import { combinedKnowledge, fetchSharedSearch, loadLocalKnowledge } from "@/lib/knowledge-client";
import { layoutBoard, prefsFromSettings } from "@/lib/layout";
import {
  CATEGORIES,
  categoryLabel,
  normalizeSeed,
  rankedTopics,
  searchKnowledge,
  type CategoryId,
  type KnowledgeSearchHit,
  type KnowledgeStore,
} from "@/lib/topic-knowledge";
import { cn } from "@/lib/utils";

type Scope = "all" | "mine";

const CHIP =
  "rounded-full border px-3 py-1 text-xs transition hover:border-primary/50 hover:text-foreground disabled:opacity-50";

/** トピック図鑑: みんなと自分が AI で広げた話題を、お題ごとに探せるページ */
export function TopicDatabase() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [scope, setScope] = useState<Scope>("all");
  // localStorage とみんなの図鑑は読み込んだあとに差し替える（最初の描画はサーバーと同じ空のまま）
  const [store, setStore] = useState<KnowledgeStore>({});
  const [mine, setMine] = useState<KnowledgeStore>({});
  const [shared, setShared] = useState<"loading" | "on" | "off">("loading");

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(
      async () => {
        const result = await fetchSharedSearch(query);
        if (cancelled) return;
        setShared(result.available ? "on" : "off");
        setStore(combinedKnowledge());
        setMine(loadLocalKnowledge());
      },
      query ? 300 : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const source = scope === "mine" ? mine : store;
  const hits = useMemo(() => searchKnowledge(source, query, category, 60), [source, query, category]);
  const counts = useMemo(() => {
    const map = new Map<CategoryId, number>();
    for (const entry of Object.values(source)) map.set(entry.category, (map.get(entry.category) ?? 0) + 1);
    return map;
  }, [source]);
  const topicTotal = useMemo(
    () => Object.values(source).reduce((sum, entry) => sum + Object.keys(entry.topics).length, 0),
    [source],
  );

  function startBoard(hit: KnowledgeSearchHit) {
    const snapshot = getBoardSnapshot();
    const built = boardFromTopics(hit.entry.seed, rankedTopics(hit.entry));
    const board = layoutBoard(built, prefsFromSettings(snapshot.settings, false, built.pinnedNodeId));
    writeBoardSnapshot({ ...snapshot, boards: [...snapshot.boards, board], activeBoardId: board.id });
    toast.success(`「${hit.entry.seed}」のボードを作りました`, { description: "AI を使わずに図鑑から並べています" });
    router.push("/");
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-4xl flex-col px-4 py-8">
      <header className="mb-6">
        <BrandMark onHome={() => router.push("/")} />
        <h1 className="mt-4 flex items-center gap-2 text-2xl font-semibold">
          <BookOpen className="size-6 text-primary" />
          トピック図鑑
        </h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          みんなが AI で広げた話題を、お題ごとにまとめています。同じお題や似たお題を広げるときは、AI
          を呼ばずにここから候補を出します。
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          お題 {Object.keys(source).length} 件 · 話題 {topicTotal} 語
          {shared === "off" ? " · この公開版では、はじめから入っている図鑑と自分の記録だけを表示しています" : null}
        </p>
      </header>

      <label className="relative mb-3 block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="お題・話題で検索（例: ゲーム、雨、推し）"
          className="h-11 rounded-xl bg-card/70 pl-9"
          aria-label="トピック図鑑を検索"
        />
      </label>

      <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="表示する記録">
        {(
          [
            ["all", "みんなの図鑑"],
            ["mine", "自分の記録"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={scope === id}
            className={cn(
              CHIP,
              scope === id ? "border-primary bg-primary text-primary-foreground" : "border-border/80 bg-card/70 text-muted-foreground",
            )}
            onClick={() => setScope(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-1.5" role="group" aria-label="分類">
        {[{ id: "all" as const, label: "すべて" }, ...CATEGORIES].map((item) => {
          const count = item.id === "all" ? Object.keys(source).length : (counts.get(item.id) ?? 0);
          if (item.id !== "all" && count === 0) return null;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={category === item.id}
              className={cn(
                CHIP,
                "px-2.5 py-0.5 text-[11px]",
                category === item.id ? "border-primary/60 bg-primary/10 text-foreground" : "border-border/70 text-muted-foreground",
              )}
              onClick={() => setCategory(item.id)}
            >
              {item.label}
              <span className="ml-1 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {shared === "loading" && hits.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          図鑑を読み込み中…
        </p>
      ) : hits.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {scope === "mine" && !query
            ? "まだ自分の記録はありません。ホームで話題を広げると、AI が出した話題がここにたまります。"
            : "見つかりませんでした。別の言葉で探すか、ホームでこのお題を広げてみてください。"}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {hits.map((hit) => {
            const topics = rankedTopics(hit.entry, 14);
            const q = normalizeSeed(query);
            return (
              <li key={hit.entry.seed}>
                <article className="flex h-full flex-col rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 text-sm leading-6 font-semibold break-words">{hit.entry.seed}</h2>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {categoryLabel(hit.entry.category)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {hit.entry.uses} 回広げられた · {Object.keys(hit.entry.topics).length} 語
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {topics.map((label) => (
                      <li key={label}>
                        <button
                          type="button"
                          title={`「${label}」で探す`}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px] transition hover:border-primary/50 hover:text-foreground",
                            q && normalizeSeed(label).includes(q)
                              ? "border-primary/60 bg-primary/10 text-foreground"
                              : "border-border text-muted-foreground",
                          )}
                          onClick={() => setQuery(label)}
                        >
                          {label}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto flex justify-end pt-3">
                    <Button size="sm" onClick={() => startBoard(hit)}>
                      <Sparkles />
                      このお題でボードを作る
                    </Button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        話題の文言は AI が作ったものを名前なしで集めています。一覧には、2回以上使われたお題だけが載ります。
        <Link href="/" className="ml-1 inline-flex items-center gap-0.5 underline-offset-2 hover:underline">
          ホームで広げる
          <ArrowRight className="size-3" />
        </Link>
      </p>

      <div className="mt-10">
        <AdSlot />
      </div>
      <SiteLinks className="mt-2" />
    </div>
  );
}
