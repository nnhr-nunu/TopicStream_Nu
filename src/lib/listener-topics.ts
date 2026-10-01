import { isPublicSafe } from "@/lib/public-text";

/**
 * リスナーのお題箱: 視聴者がコメントで「お題:〇〇」と書いたものを候補として貯める（純粋な計算だけ）。
 * 画面に出すのは配信者の画面だけ。押すとカードになる（use-board-controller.ts の adoptListenerTopic）
 */

/** 箱に貯めておく数。超えたら少なくて古いものから落とす */
export const BOX_LIMIT = 20;
/** コメント欄の上に出す数。ここから先は下の帯のボタンから開く一覧に入る */
export const COLUMN_LIMIT = 4;
export const TOPIC_MAX = 30;
/** 消した・使ったお題を覚えておく数（同じ言葉が来ても戻さない） */
const HANDLED_LIMIT = 200;

export type ListenerTopic = {
  /** 同じお題とみなすための形（topicKey） */
  key: string;
  /** 最初に届いた書き方 */
  label: string;
  count: number;
  lastAt: number;
};

export type TopicBox = {
  /** 数の多い順 → 新しい順 */
  topics: ListenerTopic[];
  /** 消した・使ったお題の key */
  handled: string[];
};

export function emptyTopicBox(): TopicBox {
  return { topics: [], handled: [] };
}

/** 文の先頭の「お題:」「お題：」「#お題」「【お題】」（NFKC 後）。途中の「お題」や「お題箱」は拾わない */
const PREFIX = /^\s*(?:お題\s*:|#\s*お題(?:\s*:|\s+)|【\s*お題\s*】|\[\s*お題\s*\])([\s\S]*)$/u;
const QUOTES = /^[「『"“]\s*([\s\S]*?)\s*[」』"”]$/u;
const HAS_WORD = /[\p{L}\p{N}]/u;
const ONLY_LAUGH = /^[wｗ草]+$/iu;

/**
 * コメントがお題なら { topic }、お題の書き方だが使えない（空・長すぎ・URL・暴言）なら { topic: null }、
 * お題のコメントでなければ null
 */
export function parseListenerTopic(text: string): { topic: string | null } | null {
  const match = text.normalize("NFKC").match(PREFIX);
  if (!match) return null;
  let body = (match[1] ?? "").replace(/\s+/gu, " ").trim();
  const quoted = body.match(QUOTES);
  if (quoted) body = (quoted[1] ?? "").trim();
  if (!body || body.length > TOPIC_MAX || !HAS_WORD.test(body) || ONLY_LAUGH.test(body)) return { topic: null };
  if (!isPublicSafe(body)) return { topic: null };
  return { topic: body };
}

/** 全角半角・空白・大文字小文字・末尾の！？w をそろえる（「夏の思い出！！」と「夏の 思い出」は同じ） */
export function topicKey(label: string): string {
  const normalized = label.normalize("NFKC").toLowerCase().replace(/\s+/gu, "");
  // 「猫ww!!」「猫!!ww」のように混ざっても消す。英単語の終わりの w（bow）は残す
  let key = normalized;
  for (let previous = ""; previous !== key; ) {
    previous = key;
    key = key.replace(/[!?。．.、,~〜…]+$/u, "").replace(/(?<![a-z])w+$/u, "");
  }
  return key || normalized;
}

export function sortTopics(topics: ListenerTopic[]): ListenerTopic[] {
  return [...topics].sort((a, b) => b.count - a.count || b.lastAt - a.lastAt);
}

export function addTopic(box: TopicBox, label: string, now: number): TopicBox {
  const key = topicKey(label);
  if (box.handled.includes(key)) return box;
  const existing = box.topics.find((topic) => topic.key === key);
  const topics = existing
    ? box.topics.map((topic) => (topic.key === key ? { ...topic, count: topic.count + 1, lastAt: now } : topic))
    : [...box.topics, { key, label, count: 1, lastAt: now }];
  return { ...box, topics: sortTopics(topics).slice(0, BOX_LIMIT) };
}

function handle(box: TopicBox, keys: string[]): string[] {
  return [...box.handled.filter((key) => !keys.includes(key)), ...keys].slice(-HANDLED_LIMIT);
}

/** 1 件消す（使ったときも同じ）。同じ言葉が来ても戻さない */
export function removeTopic(box: TopicBox, key: string): TopicBox {
  return { topics: box.topics.filter((topic) => topic.key !== key), handled: handle(box, [key]) };
}

export function clearTopics(box: TopicBox): TopicBox {
  return { topics: [], handled: handle(box, box.topics.map((topic) => topic.key)) };
}

/** sessionStorage から読んだ値を確かめる（壊れていたら空の箱） */
export function asTopicBox(data: unknown): TopicBox {
  if (!data || typeof data !== "object") return emptyTopicBox();
  const raw = data as { topics?: unknown; handled?: unknown };
  const topics = Array.isArray(raw.topics)
    ? raw.topics.filter(
        (topic): topic is ListenerTopic =>
          Boolean(topic) &&
          typeof topic.key === "string" &&
          typeof topic.label === "string" &&
          typeof topic.count === "number" &&
          typeof topic.lastAt === "number",
      )
    : [];
  const handled = Array.isArray(raw.handled) ? raw.handled.filter((key): key is string => typeof key === "string") : [];
  return { topics: sortTopics(topics).slice(0, BOX_LIMIT), handled: handled.slice(-HANDLED_LIMIT) };
}
