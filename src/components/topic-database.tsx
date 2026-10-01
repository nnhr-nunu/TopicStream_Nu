"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, CornerDownRight, Eye, Heart, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { AdSlot } from "@/components/ad-slot";
import { BrandMark } from "@/components/brand-mark";
import { MODE_ICONS, ModeBadge } from "@/components/mode-picker";
import { SiteLinks } from "@/components/site-links";
import { entryPicks, TopicPreviewDialog } from "@/components/topic-preview-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openBoardFromTopics } from "@/lib/board-start";
import { requestStartKeyword } from "@/lib/board-store";
import { loadFavoriteTopics, subscribeTopicFavorites, toggleFavoriteTopic } from "@/lib/favorites";
import { combinedKnowledge, fetchSharedRelated, fetchSharedSearch, loadLocalKnowledge } from "@/lib/knowledge-client";
import { MODE_PRESETS, modePreset } from "@/lib/modes";
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
  type ModeCounts,
} from "@/lib/topic-knowledge";
import { topicPageHref } from "@/lib/topic-pages";
import type { BoardMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { splitMix } from "@/lib/combine";

type Scope = "all" | "mine" | "fav";

/** ♡ タブを開いたとき、手元に無いお題をみんなの図鑑へ探しに行く数の上限 */
const FAV_LOOKUPS = 12;

const NO_FAVORITES: string[] = [];
const NO_COUNTS: ModeCounts = { categories: {}, topics: 0 };

const CHIP =
  "rounded-full border px-3 py-1 text-xs transition hover:border-primary/50 hover:text-foreground disabled:opacity-50";

/**
 * トピック図鑑: みんなと自分が広げた話題を、お題ごとに探せるページ。
 * children は一覧の下に置く（サーバー側で書き出す、お題ごとのページへのリンク集）
 */
export function TopicDatabase({ children }: { children?: ReactNode }) {
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
  const favs = useSyncExternalStore(subscribeTopicFavorites, loadFavoriteTopics, () => NO_FAVORITES);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(
      async () => {
        const result = await fetchSharedSearch(query, mode);
        if (cancelled) return;
        setShared(result.available ? "on" : "off");
        if (result.counts) setSharedCounts(result.counts);
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
  // サーバーは全モードの数を 1 回で返す（無ければ手元の分だけで数える）
  const sharedForMode = scope === "all" && sharedCounts?.byMode ? (sharedCounts.byMode[mode] ?? NO_COUNTS) : null;
  const counts = useMemo(() => {
    const map = new Map<CategoryId, number>();
    for (const entry of Object.values(source)) map.set(entry.category, (map.get(entry.category) ?? 0) + 1);
    for (const [id, count] of Object.entries(sharedForMode?.categories ?? {}) as [CategoryId, number][]) {
      map.set(id, Math.max(map.get(id) ?? 0, count));
    }
    return map;
  }, [source, sharedForMode]);
  const topicTotal = useMemo(() => {
    const local = Object.values(source).reduce((sum, entry) => sum + Object.keys(entry.topics).length, 0);
    return Math.max(local, sharedForMode?.topics ?? 0);
  }, [source, sharedForMode]);
  // ♡ タブ: ♡ したお題（モードは問わない）と、図鑑に見つからない ♡（いっしょに見る画面で ♡ したカードの語など）
  const favHits = useMemo(() => {
    const liked = Object.fromEntries(Object.entries(store).filter(([, entry]) => favs.includes(entry.seed)));
    return searchKnowledge(liked, query, "all", 200, "all");
  }, [store, favs, query]);
  const favLoose = useMemo(() => {
    const found = new Set(Object.values(store).map((entry) => entry.seed));
    const q = normalizeSeed(query);
    return favs.filter((label) => !found.has(label) && (!q || normalizeSeed(label).includes(q))).reverse();
  }, [store, favs, query]);
  // ♡ タブを開いたら、手元に無い ♡ のお題をみんなの図鑑へ探しに行く（前に ♡ したお題の語も見られるように）
  useEffect(() => {
    if (scope !== "fav") return;
    let cancelled = false;
    const known = new Set(Object.values(combinedKnowledge()).map((entry) => entry.seed));
    const missing = loadFavoriteTopics()
      .filter((label) => !known.has(label))
      .slice(-FAV_LOOKUPS);
    if (missing.length === 0) return;
    void Promise.all(missing.map((label) => fetchSharedRelated(label))).then(() => {
      if (!cancelled) setStore(combinedKnowledge());
    });
    return () => {
      cancelled = true;
    };
  }, [scope]);
  const shown = scope === "fav" ? favHits : hits;
  const seedTotal = modeCounts.get(mode) ?? 0;
  const preset = modePreset(mode);
  // 最初の読み込みが終わるまで数は出さない（手元の数 → みんなの数へ跳ねて見えないように）
  const ready = shared !== "loading";

  function startBoard(hit: KnowledgeSearchHit) {
    openBoardFromTopics(hit.entry.seed, rankedTopics(hit.entry), entryMode(hit.entry));
    toast.success(`「${hit.entry.seed}」のマップを作りました`, { description: "図鑑で人気の話題から並べました" });
    router.push("/");
  }

  /** 図鑑に語の無い ♡（カードの語など）は、ホームと同じ始め方（AI・図鑑）で広げる */
  function startKeyword(keyword: string) {
    requestStartKeyword(keyword);
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
          TopicStream で広げられた話題を、モード・お題ごとに集めています。「次なに話そう」「ほかの人はどう考えた？」のヒントにどうぞ。
          気になるお題は、そのまま自分のマップにできます。
        </p>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="home-stat">
            <b>{ready ? seedTotal.toLocaleString() : "…"}</b>お題
          </span>
          <span className="home-stat">
            <b>{ready ? topicTotal.toLocaleString() : "…"}</b>話題
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

      <div className={cn("flex flex-wrap gap-2", scope === "fav" ? "mb-6" : "mb-2")} role="group" aria-label="表示する記録">
        {(
          [
            ["all", "みんなの図鑑"],
            ["mine", "自分の記録"],
            ["fav", "♡ した話題"],
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
            {id === "fav" && favs.length > 0 ? <span className="ml-1 tabular-nums opacity-80">{favs.length}</span> : null}
          </button>
        ))}
      </div>

      {/* モード（親）→ 分類（子）。選んだモードのタブの下に、そのモードの分類の枠をつなげて出す（♡ はモードを問わず並べる） */}
      <section className={cn("topic-db-filter mb-6", scope === "fav" && "hidden")} data-mode={mode}>
        <div className="topic-db-modes" role="group" aria-label="モード">
          {MODE_PRESETS.map((item) => {
            const Icon = MODE_ICONS[item.id];
            return (
              <button
                key={item.id}
                type="button"
                data-mode={item.id}
                aria-pressed={mode === item.id}
                className="topic-db-mode"
                onClick={() => {
                  setMode(item.id);
                  setCategory("all");
                }}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {item.label}
                {ready ? <span className="topic-db-count">{modeCounts.get(item.id) ?? 0}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="topic-db-cats" role="group" aria-label={`${preset.label}の分類`}>
          <span className="topic-db-cats-head">
            <CornerDownRight className="size-3.5" aria-hidden />
            {preset.label}の分類
          </span>
          {ready ? (
            [{ id: "all" as const, label: "すべて" }, ...CATEGORIES].map((item) => {
              const count = item.id === "all" ? seedTotal : (counts.get(item.id) ?? 0);
              if (item.id !== "all" && count === 0) return null;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={category === item.id}
                  className="topic-db-cat"
                  onClick={() => setCategory(item.id)}
                >
                  {item.label}
                  <span className="topic-db-count">{count}</span>
                </button>
              );
            })
          ) : (
            <span className="text-[11px] text-muted-foreground">読み込み中…</span>
          )}
        </div>
      </section>

      {shared === "loading" && shown.length === 0 && scope !== "fav" ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          図鑑を読み込み中…
        </p>
      ) : shown.length === 0 && (scope !== "fav" || favLoose.length === 0) ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {scope === "fav" && !query
            ? "まだ ♡ した話題はありません。図鑑やホームのお題、いっしょに見る画面のカードで ♡ を押すと、ここに並びます。"
            : scope === "mine" && !query
              ? "まだ自分の記録はありません。ホームで話題を広げると、ここにたまっていきます。"
              : "見つかりませんでした。別の言葉で探すか、ホームでこのお題を広げてみてください。"}
        </p>
      ) : (
        <ul className="relative grid gap-3 sm:grid-cols-2" data-critter-garden data-critter-skip="frog">
          {shown.map((hit) => {
            const topics = rankedTopics(hit.entry, 14);
            const q = normalizeSeed(query);
            // 掛け合わせ（「A × B」）のお題は、それぞれの語から探せるようにする
            const mix = splitMix(hit.entry.seed);
            // お題ごとのページ（同梱のお題だけにある）
            const pageHref = topicPageHref(hit.entry.seed, entryMode(hit.entry));
            return (
              <li key={`${entryMode(hit.entry)}|${hit.entry.seed}`}>
                <article className="home-topic-card" data-critter-perch>
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
                      ) : pageHref ? (
                        <Link href={pageHref} className="underline-offset-2 hover:text-primary hover:underline">
                          {hit.entry.seed}
                        </Link>
                      ) : (
                        hit.entry.seed
                      )}
                      {scope === "fav" ? <ModeBadge mode={entryMode(hit.entry)} className="ml-1.5 align-middle" /> : null}
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
                      このお題で始める
                    </Button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {scope === "fav" && favLoose.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold">♡ したカード</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            いっしょに見る画面などで ♡ した話題です。お題にして、ここから広げられます。
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {favLoose.map((label) => (
              <li
                key={label}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm"
              >
                <Heart className="size-3.5 shrink-0 fill-current text-primary" aria-hidden />
                <span className="min-w-0 flex-1 break-words">{label}</span>
                <Button size="sm" variant="outline" onClick={() => startKeyword(label)}>
                  <Sparkles />
                  始める
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`「${label}」の ♡ を外す`}
                  title="♡ を外す"
                  onClick={() => toggleFavoriteTopic(label)}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {children}

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
        話題は名前なしで集めています（候補には自動で作ったものも含みます）。お悩み相談などのモードの内容も公開されるので、個人がわかることは書かないでください。付箋の中身は集めません。ハート・深掘り・NOW で選ばれた話題ほど上に並びます。
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
