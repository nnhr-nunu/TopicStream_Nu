import { withoutArchived } from "@/lib/topic-archive";
import {
  CATEGORIES,
  entryMode,
  knowledgeKey,
  rankedTopics,
  topicSimilarity,
  type CategoryId,
} from "@/lib/topic-knowledge";
import { seedKnowledge } from "@/lib/topic-knowledge-seed";
import type { BoardMode } from "@/lib/types";

/**
 * お題ごとの静的なページ（/topics/[slug]）。検索から来た人の入口にする。
 * 同梱の初期データ（topic-knowledge-seed-data.ts）だけから作るので、サーバーの無い公開版（GitHub Pages）でも同じページが出る。
 * みんなの図鑑（Redis）で育ったお題を載せたいときは、初期データに足す。
 */
export type TopicPage = {
  slug: string;
  seed: string;
  mode: BoardMode;
  category: CategoryId;
  /** 強い順の語 */
  topics: string[];
};

/** 3×3 の見本を埋めるのに要る語の数。足りないお題はページにしない */
const MIN_TOPICS = 8;

/**
 * URL に使う名前。日本語のままだと、静的エクスポートのファイル名や URL の符号化で崩れやすいので、
 * お題（とモード）から決まる短い英数字にする。お題の書き方を変えると URL も変わる
 */
export function topicPageSlug(seed: string, mode: BoardMode = "chat"): string {
  const key = knowledgeKey(seed, mode);
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `t${(hash >>> 0).toString(36).padStart(7, "0")}`;
}

let cached: TopicPage[] | null = null;

/** ページにするお題の一覧（分類の順 → お題の順。ビルドのたびに同じ並びになる） */
export function topicPages(): TopicPage[] {
  if (cached) return cached;
  const order = new Map(CATEGORIES.map((item, index) => [item.id, index]));
  cached = Object.values(withoutArchived(seedKnowledge()))
    .map((entry) => ({
      slug: topicPageSlug(entry.seed, entryMode(entry)),
      seed: entry.seed,
      mode: entryMode(entry),
      category: entry.category,
      topics: rankedTopics(entry),
    }))
    .filter((page) => page.topics.length >= MIN_TOPICS)
    .sort(
      (a, b) =>
        (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99) || a.seed.localeCompare(b.seed, "ja"),
    );
  return cached;
}

export function topicPageBySlug(slug: string): TopicPage | null {
  return topicPages().find((page) => page.slug === slug) ?? null;
}

/** そのお題にページがあれば、その場所（無ければ null）。末尾の / は Link が公開先に合わせて付ける */
export function topicPageHref(seed: string, mode: BoardMode = "chat"): string | null {
  const slug = topicPageSlug(seed, mode);
  return topicPages().some((page) => page.slug === slug) ? `/topics/${slug}` : null;
}

/** 近いお題（同じモード。同じ分類と、お題の言葉が似ているものを先に） */
export function relatedTopicPages(page: TopicPage, limit = 6): TopicPage[] {
  return topicPages()
    .filter((other) => other.slug !== page.slug && other.mode === page.mode)
    .map((other) => ({
      other,
      score: (other.category === page.category ? 1 : 0) + topicSimilarity(page.seed, other.seed),
    }))
    .sort((a, b) => b.score - a.score || a.other.seed.localeCompare(b.other.seed, "ja"))
    .slice(0, limit)
    .map((item) => item.other);
}
