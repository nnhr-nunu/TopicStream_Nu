"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Eye } from "lucide-react";

import { HeartButton } from "@/components/heart-button";
import { entryPicks, TopicPreviewDialog } from "@/components/topic-preview-dialog";
import { Button } from "@/components/ui/button";
import { loadFavoriteTopics, subscribeTopicFavorites, toggleFavoriteTopic } from "@/lib/favorites";

import { combinedKnowledge, fetchSharedSearch } from "@/lib/knowledge-client";
import {
  CATEGORIES,
  categoryLabel,
  searchKnowledge,
  type CategoryId,
  type KnowledgeEntry,
  type KnowledgeStore,
} from "@/lib/topic-knowledge";
import { cn } from "@/lib/utils";

/** 3列×3行。周りの語はカードに出さず「見てみる」で見せるので、そのぶんお題を多く並べる */
const SHOWN = 9;
const NO_FAVORITES: string[] = [];
/** ホームで出す分類（多すぎると選びにくいので主なものだけ） */
const HOME_CATEGORIES: CategoryId[] = ["consult", "life", "food", "people", "work", "shopping", "game", "oshi", "memory", "hobby", "talk"];

/** ホーム: トピック図鑑の中身を少しだけ見せて、そのまま始められるようにする */
export function TopicShowcase({ onStart, busy }: { onStart: (keyword: string) => void; busy?: boolean }) {
  // ホームはボードを読み込んだあと（ブラウザ側）でしか描かないので、手元の記録はすぐ読める。みんなの図鑑は届いたら重ねる
  const [store, setStore] = useState<KnowledgeStore>(() => combinedKnowledge());
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [previewing, setPreviewing] = useState<KnowledgeEntry | null>(null);
  const favs = useSyncExternalStore(subscribeTopicFavorites, loadFavoriteTopics, () => NO_FAVORITES);

  useEffect(() => {
    let cancelled = false;
    void fetchSharedSearch("").then(() => {
      if (!cancelled) setStore(combinedKnowledge());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const hits = useMemo(() => searchKnowledge(store, "", category, SHOWN), [store, category]);
  const seedTotal = Object.keys(store).length;
  const topicTotal = useMemo(
    () => Object.values(store).reduce((sum, entry) => sum + Object.keys(entry.topics).length, 0),
    [store],
  );

  return (
    <section className="home-showcase mt-12" aria-labelledby="home-showcase">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="home-eyebrow">
            <BookOpen className="size-3.5" />
            トピック図鑑
          </p>
          <h2 id="home-showcase" className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
            みんなの配信で、盛り上がった話題
          </h2>
        </div>
        <p className="flex shrink-0 gap-2 text-xs">
          <span className="home-stat">
            <b>{seedTotal.toLocaleString()}</b>お題
          </span>
          <span className="home-stat">
            <b>{topicTotal.toLocaleString()}</b>話題
          </span>
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="分類">
        {[{ id: "all" as const, label: "人気" }, ...CATEGORIES.filter((item) => HOME_CATEGORIES.includes(item.id))].map(
          (item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={category === item.id}
              className={cn("home-filter", category === item.id && "home-filter-active")}
              onClick={() => setCategory(item.id)}
            >
              {item.label}
            </button>
          ),
        )}
      </div>

      <ul className="relative mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-critter-garden data-critter-skip="frog">
        {hits.map(({ entry }, index) => {
          const liked = favs.includes(entry.seed);
          return (
            // 2列のときは9枚目が1枚だけ余るので隠す
            <li key={entry.seed} className={cn(index === SHOWN - 1 && "sm:max-lg:hidden")}>
              <article className="home-topic-card" data-critter-perch>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">{categoryLabel(entry.category)}</p>
                    <h3 className="mt-1 text-base leading-6 font-semibold break-words">{entry.seed}</h3>
                  </div>
                  <HeartButton liked={liked} count={entryPicks(entry)} onToggle={() => toggleFavoriteTopic(entry.seed)} />
                </div>
                {/* 3列のときカードが狭いので、ボタンの左右を少し詰めて2つを1行に収める（収まらない幅では折り返す） */}
                <div className="mt-auto flex flex-wrap items-center gap-1 pt-3">
                  <Button size="sm" className="px-2" onClick={() => setPreviewing(entry)}>
                    <Eye />
                    見てみる
                  </Button>
                  <Button size="sm" variant="outline" className="px-2" onClick={() => onStart(entry.seed)} disabled={busy}>
                    このお題で始める
                    <ArrowRight />
                  </Button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      <TopicPreviewDialog
        entry={previewing}
        busy={busy}
        onOpenChange={(open) => {
          if (!open) setPreviewing(null);
        }}
        onStart={onStart}
      />

      <div className="mt-5 flex justify-center">
        <Link href="/topics/" className="home-showcase-more">
          図鑑をぜんぶ見る
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}
