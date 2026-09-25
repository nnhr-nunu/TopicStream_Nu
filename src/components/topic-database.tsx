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
  type KnowledgeEntry,
  type KnowledgeSearchHit,
  type KnowledgeStore,
} from "@/lib/topic-knowledge";
import { cn } from "@/lib/utils";

type Scope = "all" | "mine";

/** 選ばれた重みの合計（♡・クリック・ピン・コメントのハート） */
function picksOf(entry: KnowledgeEntry): number {
  return Object.values(entry.picks ?? {}).reduce((sum, value) => sum + value, 0);
}

const CHIP =
  "rounded-full border px-3 py-1 text-xs transition hover:border-primary/50 hover:text-foreground disabled:opacity-50";

/** トピック図鑑: みんなと自分が広げた話題を、お題ごとに探せるページ */
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
    toast.success(`「${hit.entry.seed}」のボードを作りました`, { description: "図鑑で人気の話題から並べました" });
    router.push("/");
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-4xl flex-col px-4 py-8">
      <header className="mb-6">
        <BrandMark onHome={() => router.push("/")} />
        <div className="mt-6">
          <p className="home-eyebrow">
            <BookOpen className="size-3.5" />
            トピック図鑑
          </p>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">みんなの配信で、盛り上がった話題</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          TopicStream で広げられた話題を、お題ごとに集めています。♡ を押された話題・深掘りされた話題ほど上に並ぶので、
          「次なに話そう」のヒントに。気になるお題は、そのまま話題マップにできます。
        </p>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="home-stat">
            <b>{Object.keys(source).length.toLocaleString()}</b>お題
          </span>
          <span className="home-stat">
            <b>{topicTotal.toLocaleString()}</b>話題
          </span>
          {shared === "off" ? (
            <span className="text-muted-foreground">この公開版では、はじめから入っている図鑑と自分の記録を表示しています</span>
          ) : null}
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
            ? "まだ自分の記録はありません。ホームで話題を広げると、ここにたまっていきます。"
            : "見つかりませんでした。別の言葉で探すか、ホームでこのお題を広げてみてください。"}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {hits.map((hit) => {
            const topics = rankedTopics(hit.entry, 14);
            const q = normalizeSeed(query);
            return (
              <li key={hit.entry.seed}>
                <article className="home-topic-card">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 text-sm leading-6 font-semibold break-words">{hit.entry.seed}</h2>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {categoryLabel(hit.entry.category)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {hit.entry.uses} 回広げられた · {Object.keys(hit.entry.topics).length} 語
                    {picksOf(hit.entry) > 0 ? ` · ♡ ${picksOf(hit.entry)}` : null}
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {topics.map((label) => (
                      <li key={label}>
                        <button
                          type="button"
                          title={`「${label}」で探す`}
                          className={cn(
                            "home-topic-chip",
                            q && normalizeSeed(label).includes(q) && "ring-1 ring-primary/60",
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
                      このお題で話題マップを作る
                    </Button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        話題は名前なしで集めています（候補には自動で作ったものも含みます）。♡・深掘り・ピン・コメントのハートで選ばれた話題ほど上に並びます。
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
