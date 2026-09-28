"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Eye, Heart, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AdSlot } from "@/components/ad-slot";
import { BrandMark } from "@/components/brand-mark";
import { SiteLinks } from "@/components/site-links";
import { entryPicks, TopicPreviewDialog } from "@/components/topic-preview-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBoardSnapshot, requestOpenActiveBoard, writeBoardSnapshot } from "@/lib/board-store";
import { boardFromTopics } from "@/lib/catalog-data";
import { loadFavoriteTopics, subscribeTopicFavorites, toggleFavoriteTopic } from "@/lib/favorites";
import { combinedKnowledge, fetchSharedSearch, loadLocalKnowledge } from "@/lib/knowledge-client";
import { layoutBoard, prefsFromSettings } from "@/lib/layout";
import { MODE_PRESETS, modePreset, withMode } from "@/lib/modes";
import {
  CATEGORIES,
  categoryLabel,
  entryMode,
  normalizeSeed,
  rankedTopics,
  searchKnowledge,
  type CategoryId,
  type KnowledgeCounts,
  type KnowledgeSearchHit,
  type KnowledgeStore,
} from "@/lib/topic-knowledge";
import type { BoardMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { splitMix } from "@/lib/combine";

type Scope = "all" | "mine";

const NO_FAVORITES: string[] = [];

const CHIP =
  "rounded-full border px-3 py-1 text-xs transition hover:border-primary/50 hover:text-foreground disabled:opacity-50";

/** トピック図鑑: みんなと自分が広げた話題を、お題ごとに探せるページ */
export function TopicDatabase() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [scope, setScope] = useState<Scope>("all");
  const [mode, setMode] = useState<BoardMode>("chat");
  const [previewing, setPreviewing] = useState<KnowledgeSearchHit | null>(null);
  // localStorage とみんなの図鑑は読み込んだあとに差し替える（最初の描画はサーバーと同じ空のまま）
  const [store, setStore] = useState<KnowledgeStore>({});
  const [mine, setMine] = useState<KnowledgeStore>({});
  const [shared, setShared] = useState<"loading" | "on" | "off">("loading");
  // みんなの図鑑全体の数（手元には検索に合った分しか届かないので、タグの横の数はこちらも見る）
  const [sharedCounts, setSharedCounts] = useState<KnowledgeCounts | null>(null);
  const [sharedMode, setSharedMode] = useState<BoardMode | null>(null);
  const favs = useSyncExternalStore(subscribeTopicFavorites, loadFavoriteTopics, () => NO_FAVORITES);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(
      async () => {
        const result = await fetchSharedSearch(query, mode);
        if (cancelled) return;
        setShared(result.available ? "on" : "off");
        if (result.counts) {
          setSharedCounts(result.counts);
          setSharedMode(mode);
        }
        setStore(combinedKnowledge());
        setMine(loadLocalKnowledge());
      },
      query ? 300 : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, mode]);

  const scoped = scope === "mine" ? mine : store;
  // 雑談・お悩み相談などのモードごとに分けて見せる（混ぜると雑談のネタ探しの邪魔になる）
  const source = useMemo(
    () => Object.fromEntries(Object.entries(scoped).filter(([, entry]) => entryMode(entry) === mode)),
    [scoped, mode],
  );
  const modeCounts = useMemo(() => {
    const map = new Map<BoardMode, number>();
    for (const entry of Object.values(scoped)) map.set(entryMode(entry), (map.get(entryMode(entry)) ?? 0) + 1);
    if (scope === "all" && sharedCounts) {
      for (const [id, count] of Object.entries(sharedCounts.modes) as [BoardMode, number][]) {
        map.set(id, Math.max(map.get(id) ?? 0, count));
      }
    }
    return map;
  }, [scoped, scope, sharedCounts]);
  const hits = useMemo(() => searchKnowledge(source, query, category, 60, mode), [source, query, category, mode]);
  const counts = useMemo(() => {
    const map = new Map<CategoryId, number>();
    for (const entry of Object.values(source)) map.set(entry.category, (map.get(entry.category) ?? 0) + 1);
    // 分類の数はモードを切り替えると届き直す。前のモードの数を混ぜない
    if (scope === "all" && sharedCounts && sharedMode === mode) {
      for (const [id, count] of Object.entries(sharedCounts.categories) as [CategoryId, number][]) {
        map.set(id, Math.max(map.get(id) ?? 0, count));
      }
    }
    return map;
  }, [source, scope, sharedCounts, sharedMode, mode]);
  const topicTotal = useMemo(() => {
    const local = Object.values(source).reduce((sum, entry) => sum + Object.keys(entry.topics).length, 0);
    return scope === "all" && sharedCounts && sharedMode === mode ? Math.max(local, sharedCounts.topics ?? 0) : local;
  }, [source, scope, sharedCounts, sharedMode, mode]);
  const seedTotal = modeCounts.get(mode) ?? 0;
  const preset = modePreset(mode);

  function startBoard(hit: KnowledgeSearchHit) {
    const snapshot = getBoardSnapshot();
    const built = withMode(boardFromTopics(hit.entry.seed, rankedTopics(hit.entry)), entryMode(hit.entry));
    const board = layoutBoard(built, prefsFromSettings(snapshot.settings, false, built.pinnedNodeId));
    writeBoardSnapshot({ ...snapshot, boards: [...snapshot.boards, board], activeBoardId: board.id });
    toast.success(`「${hit.entry.seed}」のボードを作りました`, { description: "図鑑で人気の話題から並べました" });
    requestOpenActiveBoard();
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
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {mode === "chat" ? "みんなの配信で、盛り上がった話題" : `みんなの「${preset.label}」で出た切り口`}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          TopicStream で広げられた話題を、モード・お題ごとに集めています。♡ を押された話題・深掘りされた話題ほど上に並ぶので、
          「次なに話そう」「ほかの人はどう考えた？」のヒントに。気になるお題は、そのまま話題マップにできます。
        </p>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="home-stat">
            <b>{seedTotal.toLocaleString()}</b>お題
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

      <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="モード">
        {MODE_PRESETS.map((item) => {
          const count = modeCounts.get(item.id) ?? 0;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={mode === item.id}
              className={cn(
                CHIP,
                mode === item.id ? "border-primary/60 bg-primary/10 text-foreground" : "border-border/70 text-muted-foreground",
              )}
              onClick={() => {
                setMode(item.id);
                setCategory("all");
              }}
            >
              {item.label}
              <span className="ml-1 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-6 flex flex-wrap gap-1.5" role="group" aria-label="分類">
        {[{ id: "all" as const, label: "すべて" }, ...CATEGORIES].map((item) => {
          const count = item.id === "all" ? seedTotal : (counts.get(item.id) ?? 0);
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
            // 掛け合わせ（「A × B」）のお題は、それぞれの語から探せるようにする
            const mix = splitMix(hit.entry.seed);
            return (
              <li key={`${mode}|${hit.entry.seed}`}>
                <article className="home-topic-card">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 text-sm leading-6 font-semibold break-words">
                      {mix ? (
                        <>
                          <button type="button" className="topic-db-mix-part" onClick={() => setQuery(mix[0])}>
                            {mix[0]}
                          </button>
                          <span className="mx-1 text-primary" aria-label="と">
                            ×
                          </span>
                          <button type="button" className="topic-db-mix-part" onClick={() => setQuery(mix[1])}>
                            {mix[1]}
                          </button>
                        </>
                      ) : (
                        hit.entry.seed
                      )}
                    </h2>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px]",
                        mix ? "bg-primary/15 font-semibold text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {mix ? "掛け合わせ" : categoryLabel(hit.entry.category)}
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
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                    <Button size="sm" onClick={() => setPreviewing(hit)}>
                      <Eye />
                      見てみる
                    </Button>
                    <Button
                      size="sm"
                      variant={favs.includes(hit.entry.seed) ? "secondary" : "outline"}
                      onClick={() => toggleFavoriteTopic(hit.entry.seed)}
                      aria-label={favs.includes(hit.entry.seed) ? "ハートを外す" : "ハートを付ける"}
                    >
                      <Heart className={favs.includes(hit.entry.seed) ? "fill-current" : undefined} />
                      {entryPicks(hit.entry)}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => startBoard(hit)}>
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

      <TopicPreviewDialog
        entry={previewing?.entry ?? null}
        onOpenChange={(open) => {
          if (!open) setPreviewing(null);
        }}
        onStart={() => {
          if (previewing) startBoard(previewing);
        }}
      />

      <p className="mt-6 text-center text-xs text-muted-foreground">
        話題は名前なしで集めています（候補には自動で作ったものも含みます）。お悩み相談などのモードの内容も公開されるので、個人がわかることは書かないでください。付箋の中身は集めません。♡・深掘り・ピン・コメントのハートで選ばれた話題ほど上に並びます。
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
