"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Heart } from "lucide-react";

import { combinedKnowledge, fetchSharedSearch } from "@/lib/knowledge-client";
import {
  CATEGORIES,
  categoryLabel,
  rankedTopics,
  searchKnowledge,
  type CategoryId,
  type KnowledgeEntry,
  type KnowledgeStore,
} from "@/lib/topic-knowledge";
import { cn } from "@/lib/utils";

const SHOWN = 6;
/** ホームで出す分類（多すぎると選びにくいので主なものだけ） */
const HOME_CATEGORIES: CategoryId[] = ["life", "food", "shopping", "game", "oshi", "memory", "talk"];

function picksOf(entry: KnowledgeEntry): number {
  return Object.values(entry.picks ?? {}).reduce((sum, value) => sum + value, 0);
}

/** ホーム: トピック図鑑の中身を少しだけ見せて、そのまま始められるようにする */
export function TopicShowcase({ onStart, busy }: { onStart: (keyword: string) => void; busy?: boolean }) {
  // ホームはボードを読み込んだあと（ブラウザ側）でしか描かないので、手元の記録はすぐ読める。みんなの図鑑は届いたら重ねる
  const [store, setStore] = useState<KnowledgeStore>(() => combinedKnowledge());
  const [category, setCategory] = useState<CategoryId | "all">("all");

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

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {hits.map(({ entry }) => {
          const picks = picksOf(entry);
          return (
            <li key={entry.seed}>
              <article className="home-topic-card">
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>{categoryLabel(entry.category)}</span>
                  {picks > 0 ? (
                    <span className="inline-flex items-center gap-0.5">
                      <Heart className="size-3 fill-current text-primary" />
                      {picks}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-1 text-base leading-6 font-semibold break-words">{entry.seed}</h3>
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {rankedTopics(entry, 6).map((label) => (
                    <li key={label}>
                      <button
                        type="button"
                        className="home-topic-chip"
                        title={`「${label}」から始める`}
                        onClick={() => onStart(label)}
                        disabled={busy}
                      >
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="home-topic-go"
                  onClick={() => onStart(entry.seed)}
                  disabled={busy}
                >
                  このお題で始める
                  <ArrowRight className="size-3.5" />
                </button>
              </article>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex justify-center">
        <Link href="/topics/" className="home-showcase-more">
          図鑑をぜんぶ見る
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}
