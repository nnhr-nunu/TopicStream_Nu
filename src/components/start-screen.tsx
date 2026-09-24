"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Dices, History, ShieldAlert, Sparkles } from "lucide-react";

import { AdSlot } from "@/components/ad-slot";
import { DeveloperFooter } from "@/components/developer-footer";
import { PRIVACY_NOTICE } from "@/components/privacy-notice";
import { StreamDirectory } from "@/components/stream-directory";
import { ThemeBoardList } from "@/components/theme-board-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogBoard } from "@/lib/catalog-data";
import { SEED_TOPIC_SCORES } from "@/lib/catalog-data";
import { mergePopularTopics, pickWeightedStarter, type PopularTopic } from "@/lib/popularity";
import type { Board } from "@/lib/types";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function formatUpdated(ms: number): string {
  const date = new Date(ms);
  const sameDay = date.toDateString() === new Date().toDateString();
  const hm = `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
  return sameDay ? `今日 ${hm}` : `${date.getMonth() + 1}/${date.getDate()} ${hm}`;
}

function rootLabel(board: Board): string {
  return board.nodes.find((node) => node.data.parentId === null)?.data.label ?? "";
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold tracking-wide">{children}</h2>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** ホーム: 続きから → 新しく始める → 人気のトピック → 配信 → みんなのテーマ */
export function StartScreen({
  boards,
  activeBoardId,
  onStart,
  onOpenBoard,
  onImport,
  busy,
  linkedUrl,
  linkedTitle,
  linkedStreamer,
  linkedWatchId,
}: {
  boards: Board[];
  activeBoardId: string;
  onStart: (keyword: string) => void;
  onOpenBoard: (id: string) => void;
  onImport: (board: CatalogBoard) => void;
  busy?: boolean;
  linkedUrl?: string;
  linkedTitle?: string;
  linkedStreamer?: string;
  linkedWatchId?: string;
}) {
  const [keyword, setKeyword] = useState("");
  const [popular, setPopular] = useState<PopularTopic[]>(SEED_TOPIC_SCORES.slice(0, 12));
  const recent = boards
    .filter((board) => board.nodes.length > 0)
    .sort((a, b) => (a.id === activeBoardId ? -1 : b.id === activeBoardId ? 1 : b.updatedAt - a.updatedAt))
    .slice(0, 3);

  useEffect(() => {
    void fetch("/api/catalog")
      .then((response) => response.json())
      .then((json: { popular?: PopularTopic[] }) => {
        setPopular(mergePopularTopics(json.popular ?? []));
      })
      .catch(() => setPopular(mergePopularTopics()));
  }, []);

  return (
    <div className="home-scroll">
      <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-24 sm:pt-28">
        <header className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- 静的エクスポート（Pages）でも同じパスで出すため */}
          <img src={`${base}/topicstream-logo.svg`} alt="" width={64} height={64} className="size-16 rounded-2xl" />
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            TopicStream<span className="ml-1 text-2xl font-semibold text-muted-foreground sm:text-3xl">(ぬ)</span>
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            雑談配信のための話題マップ。キーワードから、話したいことがすぐ広がります。
          </p>
        </header>

        {recent.length > 0 ? (
          <section className="mt-10" aria-labelledby="home-resume">
            <SectionTitle>
              <span id="home-resume" className="inline-flex items-center gap-1.5">
                <History className="size-4 text-primary" />
                続きから
              </span>
            </SectionTitle>
            <ul className="grid gap-2">
              {recent.map((board, index) => (
                <li key={board.id}>
                  <button
                    type="button"
                    className={index === 0 ? "home-resume home-resume-primary" : "home-resume"}
                    onClick={() => onOpenBoard(board.id)}
                  >
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-semibold">{board.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {rootLabel(board) ? `「${rootLabel(board)}」から · ` : ""}カード {board.nodes.length}枚 ·{" "}
                        {formatUpdated(board.updatedAt)}
                      </span>
                    </span>
                    <span className="home-resume-go">
                      マップを開く
                      <ArrowRight className="size-4" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-10" aria-labelledby="home-new">
          <SectionTitle hint={recent.length > 0 ? "新しいボードで始めます。今のボードはそのまま残ります。" : undefined}>
            <span id="home-new" className="inline-flex items-center gap-1.5">
              <Sparkles className="size-4 text-primary" />
              新しく始める
            </span>
          </SectionTitle>
          <form
            className="home-start"
            onSubmit={(event) => {
              event.preventDefault();
              if (keyword.trim()) onStart(keyword.trim());
            }}
          >
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="今日話したいキーワード（例: 夏休みの思い出）"
              aria-label="開始キーワード"
              className="h-12 flex-1 rounded-xl border-0 bg-transparent px-3 text-base shadow-none focus-visible:ring-0"
              autoFocus={recent.length === 0}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="shrink-0 rounded-xl"
              aria-label="ランダムなキーワードを入れる"
              title="ランダムなキーワードを入れる"
              onClick={() => setKeyword(pickWeightedStarter(keyword ? [keyword] : []))}
              disabled={busy}
            >
              <Dices />
            </Button>
            <Button type="submit" size="lg" className="h-11 shrink-0 rounded-xl px-5" disabled={busy || !keyword.trim()}>
              始める
              <ArrowRight />
            </Button>
          </form>

          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
            {PRIVACY_NOTICE}
          </p>

          <div className="mt-4">
            <p className="mb-2 text-xs text-muted-foreground">よく選ばれているトピックから始める</p>
            <ul className="flex flex-wrap gap-2">
              {popular.slice(0, 12).map((topic, index) => (
                <li key={topic.label}>
                  <button
                    type="button"
                    className="rounded-full border border-border/80 bg-card/70 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                    onClick={() => onStart(topic.label)}
                    disabled={busy}
                  >
                    {index < 3 ? <span className="mr-1 font-semibold text-primary">{index + 1}</span> : null}
                    {topic.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <StreamDirectory
          linkedUrl={linkedUrl}
          linkedTitle={linkedTitle}
          linkedStreamer={linkedStreamer}
          linkedWatchId={linkedWatchId}
        />
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 pb-20">
        <h2 className="mb-4 text-center text-lg font-semibold">みんなのトークテーマ</h2>
        <ThemeBoardList onImport={onImport} busy={busy} />
      </div>

      <AdSlot />

      <DeveloperFooter />
    </div>
  );
}
