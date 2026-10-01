"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowRight, Dices, History, ShieldAlert } from "lucide-react";

import { AdSlot, SideAdRail } from "@/components/ad-slot";
import { DeveloperFooter } from "@/components/developer-footer";
import { ModeBadge, ModePicker } from "@/components/mode-picker";
import { PRIVACY_NOTICE } from "@/components/privacy-notice";
import { StreamDirectory } from "@/components/stream-directory";
import { ThemeBoardList } from "@/components/theme-board-list";
import { TopicShowcase } from "@/components/topic-showcase";
import { UsageGallery } from "@/components/usage-gallery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogBoard } from "@/lib/catalog-data";
import { SEED_TOPIC_SCORES } from "@/lib/catalog-data";
import { fetchCatalog } from "@/lib/catalog-client";
import { DEFAULT_MODE, modePreset, pickModeStarter } from "@/lib/modes";
import { mergePopularTopics, pickWeightedStarter, type PopularTopic } from "@/lib/popularity";
import { looksAbusive } from "@/lib/public-text";
import type { Board, BoardMode } from "@/lib/types";

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

/** 入力欄が狭くて、案内の文（「…、または 🎲 でランダム」「…（例: …）」）が途中で切れる幅 */
const NARROW_QUERY = "(max-width: 639px)";

function subscribeNarrow(onChange: () => void) {
  const media = window.matchMedia(NARROW_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** 狭い画面では、案内の文の前半（「話したいお題を入力」）だけにする */
function shortPlaceholder(text: string): string {
  return text.split(/[、（]/u)[0] ?? text;
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold tracking-wide">{children}</h2>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** ホーム: 始める（ヒーロー）→ 続きから → できること → トピック図鑑 → みんなのテーマ → 配信 */
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
  onStart: (keyword: string, mode: BoardMode) => void;
  onOpenBoard: (id: string) => void;
  onImport: (board: CatalogBoard) => void;
  busy?: boolean;
  linkedUrl?: string;
  linkedTitle?: string;
  linkedStreamer?: string;
  linkedWatchId?: string;
}) {
  const [keyword, setKeyword] = useState("");
  const [mode, setMode] = useState<BoardMode>(DEFAULT_MODE);
  // 暴言・晒しの呼びかけ・差別語は始める前に止める（重い悩みは止めない。判定は public-text.ts）
  const abusive = looksAbusive(keyword);
  const preset = modePreset(mode);
  const isChat = mode === DEFAULT_MODE;
  const narrow = useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  );
  const [popular, setPopular] = useState<PopularTopic[]>(SEED_TOPIC_SCORES.slice(0, 12));
  const recent = boards
    .filter((board) => board.nodes.length > 0)
    .sort((a, b) => (a.id === activeBoardId ? -1 : b.id === activeBoardId ? 1 : b.updatedAt - a.updatedAt))
    .slice(0, 3);

  useEffect(() => {
    void fetchCatalog()
      .then((json) => {
        setPopular(mergePopularTopics(json.popular ?? []));
      })
      .catch(() => setPopular(mergePopularTopics()));
  }, []);

  return (
    <div className="home-scroll">
      <div className="home-layout">
        <div className="home-rail">
          <SideAdRail />
        </div>
        {/* 本文はすべて同じ幅の 1 カラムにそろえる（セクションごとに幅を変えない） */}
        <div className="mx-auto w-full min-w-0 max-w-4xl px-4 pt-24 sm:pt-28">
          <header className="flex flex-col items-center text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- 静的エクスポート（Pages）でも同じパスで出すため */}
            <img src={`${base}/topicstream-logo.svg`} alt="" width={56} height={56} className="size-14 rounded-2xl" />
            <p className="mt-4 text-sm font-semibold text-primary">
              TopicStream<span className="ml-0.5 text-xs">(ぬ)</span>
            </p>
            <h1 className="mt-2 text-3xl leading-tight font-bold tracking-tight text-balance sm:text-5xl">
              もう、話題に詰まらない。
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-pretty text-muted-foreground sm:text-base">
              お題をひとつ入れるだけで、話せるネタや考えの切り口が 8 方向に広がる。
            </p>

            <div className="mt-7 w-full max-w-2xl">
              <ModePicker value={mode} onChange={setMode} disabled={busy} />
            </div>
            <form
              className="home-start mt-2 w-full max-w-2xl"
              data-mode={mode}
              onSubmit={(event) => {
                event.preventDefault();
                if (keyword.trim() && !abusive) onStart(keyword.trim(), mode);
              }}
            >
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={narrow ? shortPlaceholder(preset.placeholder) : preset.placeholder}
                aria-label="開始キーワード"
                aria-invalid={abusive || undefined}
                aria-describedby={abusive ? "home-start-abusive" : undefined}
                className="h-12 min-w-0 flex-1 rounded-xl border-0 bg-transparent px-3 text-base shadow-none focus-visible:ring-0 max-sm:placeholder:text-sm"
                autoFocus={recent.length === 0}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                className="shrink-0 rounded-xl"
                aria-label="おまかせでお題を入れる"
                title="おまかせでお題を入れる"
                onClick={() => {
                  const exclude = keyword ? [keyword] : [];
                  setKeyword(pickModeStarter(mode, exclude) ?? pickWeightedStarter(exclude));
                }}
                disabled={busy}
              >
                <Dices />
              </Button>
              <Button type="submit" size="lg" className="h-11 shrink-0 rounded-xl px-5" disabled={busy || !keyword.trim() || abusive}>
                始める
                <ArrowRight />
              </Button>
            </form>
            {abusive ? (
              <p id="home-start-abusive" role="alert" className="mt-2 text-xs text-destructive">
                人を傷つける言葉が入っているので、このお題では始められません。
              </p>
            ) : null}

            {isChat ? (
              <div className="mt-4 w-full max-w-2xl">
                <p className="mb-2 text-xs text-muted-foreground">人気のお題から始める</p>
                <ul className="flex flex-wrap justify-center gap-2">
                  {popular.slice(0, 10).map((topic, index) => (
                    <li key={topic.label} className={index >= 6 ? "max-sm:hidden" : undefined}>
                      <button
                        type="button"
                        className="rounded-full border border-border/80 bg-card/70 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                        onClick={() => onStart(topic.label, DEFAULT_MODE)}
                        disabled={busy}
                      >
                        {index < 3 ? <span className="mr-1 font-semibold text-primary">{index + 1}</span> : null}
                        {topic.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-4 w-full max-w-2xl">
                <p className="mb-2 text-xs text-muted-foreground">例から始める</p>
                <ul className="flex flex-wrap justify-center gap-2">
                  {preset.starters.map((topic, index) => (
                    <li key={topic} className={index >= 6 ? "max-sm:hidden" : undefined}>
                      <button
                        type="button"
                        className="rounded-full border border-border/80 bg-card/70 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                        onClick={() => onStart(topic, mode)}
                        disabled={busy}
                      >
                        {topic}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
              {PRIVACY_NOTICE}
            </p>
            {preset.note ? <p className="mt-1.5 max-w-xl text-[11px] text-muted-foreground">{preset.note}</p> : null}
          </header>

          {recent.length > 0 ? (
            <section className="mt-12" aria-labelledby="home-resume">
              <SectionTitle>
                <span id="home-resume" className="inline-flex items-center gap-1.5">
                  <History className="size-4 text-primary" />
                  続きから
                </span>
              </SectionTitle>
              {/* grid-cols-1（minmax(0,1fr)）にしないと、長い名前のぶんだけ列が広がってスマホで右にはみ出す */}
              <ul className="grid grid-cols-1 gap-2">
                {recent.map((board, index) => (
                  <li key={board.id}>
                    <button
                      type="button"
                      className={index === 0 ? "home-resume home-resume-primary" : "home-resume"}
                      onClick={() => onOpenBoard(board.id)}
                    >
                      <span className="min-w-0 flex-1 text-left">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">{board.name}</span>
                          <ModeBadge mode={board.mode} />
                        </span>
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

          <section className="mt-12" aria-labelledby="home-usage">
            <div className="mb-4 text-center">
              <h2 id="home-usage" className="text-lg font-semibold">
                できること
              </h2>
            </div>
            <UsageGallery />
          </section>

          <TopicShowcase onStart={(label) => onStart(label, DEFAULT_MODE)} busy={busy} />

          <section className="mt-14">
            <div className="mb-4 text-center">
              <h2 className="text-lg font-semibold">みんなが作った話題マップ</h2>
            </div>
            <ThemeBoardList
              onImport={onImport}
              onStart={(label) => onStart(label, DEFAULT_MODE)}
              busy={busy}
              critterSkip="frog"
              limit={6}
            />
          </section>

          <StreamDirectory
            linkedUrl={linkedUrl}
            linkedTitle={linkedTitle}
            linkedStreamer={linkedStreamer}
            linkedWatchId={linkedWatchId}
          />

          <div className="pb-16" />

          <AdSlot className="w-full pb-8" />

          <DeveloperFooter />
        </div>
        <div className="home-rail">
          <SideAdRail />
        </div>
      </div>
    </div>
  );
}
