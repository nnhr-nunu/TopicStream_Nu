"use client";

import { useEffect, useState } from "react";
import { Dices, Sparkles } from "lucide-react";

import { ThemeBoardList } from "@/components/theme-board-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogBoard } from "@/lib/catalog-data";
import { mergePopularTopics, type PopularTopic } from "@/lib/popularity";
import { SEED_TOPIC_SCORES } from "@/lib/catalog-data";

export function StartScreen({
  onStart,
  onRandom,
  onImport,
  onResume,
  busy,
}: {
  onStart: (keyword: string) => void;
  onRandom: () => void;
  onImport: (board: CatalogBoard) => void;
  onResume?: () => void;
  busy?: boolean;
}) {
  const [keyword, setKeyword] = useState("");
  const [popular, setPopular] = useState<PopularTopic[]>(SEED_TOPIC_SCORES.slice(0, 12));

  useEffect(() => {
    void fetch("/api/catalog")
      .then((response) => response.json())
      .then((json: { popular?: PopularTopic[] }) => {
        setPopular(mergePopularTopics(json.popular ?? []));
      })
      .catch(() => setPopular(mergePopularTopics()));
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-y-auto px-4 pb-16 pt-20">
      <div className="mx-auto w-full max-w-2xl">
        <img
          src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/topicstream-logo.svg`}
          alt=""
          width={72}
          height={72}
          className="mx-auto mb-5 size-[4.5rem] rounded-2xl"
        />
        <h1 className="text-balance text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          今日の雑談を、ここから
        </h1>
        <p className="mt-3 text-center text-sm leading-6 text-muted-foreground">
          キーワードをクリックすると、関連トークがすぐ近くに広がります。
        </p>

        <form
          className="mt-8 flex w-full flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (keyword.trim()) onStart(keyword.trim());
          }}
        >
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="今日話したいキーワード"
            aria-label="開始キーワード"
            className="h-11 flex-1 rounded-xl bg-card/80 px-4 text-base"
            autoFocus
          />
          <Button type="submit" size="lg" className="h-11 rounded-xl px-5" disabled={busy || !keyword.trim()}>
            <Sparkles className="size-4" />
            始める
          </Button>
        </form>

        <div className="mt-3 flex w-full flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 rounded-xl"
            onClick={onRandom}
            disabled={busy}
          >
            <Dices className="size-4" />
            ランダム
          </Button>
          {onResume ? (
            <Button type="button" variant="ghost" size="lg" className="h-11 rounded-xl" onClick={onResume}>
              マップに戻る
            </Button>
          ) : null}
        </div>

        <section className="mt-8 w-full">
          <h2 className="text-center text-xs font-medium tracking-wide text-primary">よく選ばれているトピック</h2>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {popular.slice(0, 12).map((topic, index) => (
              <li key={topic.label}>
                <button
                  type="button"
                  className="rounded-full border border-border/80 bg-card/70 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                  onClick={() => onStart(topic.label)}
                  disabled={busy}
                >
                  {index < 3 ? <span className="mr-1 text-primary">{index + 1}</span> : null}
                  {topic.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mx-auto mt-12 w-full max-w-5xl">
        <h2 className="mb-4 text-center text-lg font-semibold">みんなのトークテーマ</h2>
        <ThemeBoardList onImport={onImport} busy={busy} />
      </div>
    </div>
  );
}
