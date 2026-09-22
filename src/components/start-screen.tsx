"use client";

import { useEffect, useState } from "react";
import { Dices, Sparkles, Users } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mergePopularTopics, type PopularTopic } from "@/lib/popularity";
import { SEED_TOPIC_SCORES } from "@/lib/catalog-data";

export function StartScreen({
  onStart,
  onRandom,
  busy,
}: {
  onStart: (keyword: string) => void;
  onRandom: () => void;
  busy?: boolean;
}) {
  const [keyword, setKeyword] = useState("");
  const [popular, setPopular] = useState<PopularTopic[]>(SEED_TOPIC_SCORES.slice(0, 8));

  useEffect(() => {
    void fetch("/api/catalog")
      .then((response) => response.json())
      .then((json: { popular?: PopularTopic[] }) => {
        setPopular(mergePopularTopics(json.popular ?? []));
      })
      .catch(() => setPopular(mergePopularTopics()));
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-10">
      <p className="mb-2 text-xs tracking-[0.28em] text-primary/90">TOPICSTREAM_NU</p>
      <h1 className="text-balance text-center text-3xl font-semibold tracking-tight sm:text-4xl">
        クリックひとつで、雑談が広がる
      </h1>
      <p className="mt-3 max-w-md text-center text-sm leading-6 text-muted-foreground">
        配信者とリスナーが同じマップを見ながら話せます。よく選ばれている話題ほど、最初の提案に出てきます。
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
          className="h-11 flex-1 rounded-xl bg-card/70 px-4 text-base"
          autoFocus
        />
        <Button type="submit" size="lg" className="h-11 rounded-xl px-5" disabled={busy || !keyword.trim()}>
          <Sparkles className="size-4" />
          この話題で始める
        </Button>
      </form>

      <div className="mt-3 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-11 rounded-xl"
          onClick={onRandom}
          disabled={busy}
        >
          <Dices className="size-4" />
          ランダムなきっかけ
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-11 rounded-xl"
          nativeButton={false}
          render={<Link href="/community" />}
        >
          <Users className="size-4" />
          みんなのトークテーマ
        </Button>
      </div>

      <section className="mt-8 w-full">
        <h2 className="text-center text-xs font-medium tracking-wide text-primary">
          よく選ばれているトピック
        </h2>
        <ul className="mt-3 flex flex-wrap justify-center gap-2">
          {popular.slice(0, 8).map((topic, index) => (
            <li key={topic.label}>
              <button
                type="button"
                className="rounded-full border border-border/80 bg-card/50 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
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

      <p className="mt-8 text-center text-[11px] leading-5 text-muted-foreground">
        ショートカット: E 展開 · G 再生成 · Z 戻る · Y 進む · R ランダム
      </p>
    </div>
  );
}
