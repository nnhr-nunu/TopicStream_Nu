import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SEED_CATALOG, SEED_TOPIC_SCORES, searchCatalog, type CatalogBoard, type PopularTopic } from "@/lib/catalog-data";
import { redisCommand, redisConfig } from "@/lib/redis";
import type { Board } from "@/lib/types";

type LiveState = {
  extraFavorites: Record<string, number>;
  topicScores: Record<string, number>;
  shares: Record<string, Share>;
};

/** 人気のお題として数える語の数の上限（あふれたら弱いものから捨てる） */
const TOPIC_SCORE_LIMIT = 2_000;
/** Redis が無いとき（開発中）に手元に置く共有ボードの数 */
const SHARE_MEMORY_LIMIT = 300;
export const TOPIC_EVENT_KINDS = ["expands", "pins", "copies"] as const;

/**
 * Redis が無いとき（開発中）の置き場。Redis があれば、人気のお題・♡・共有ボードはすべて Redis に置き、
 * 全インスタンスで同じものを読む（Vercel ではインスタンスのメモリと一時ファイルは再起動で消え、インスタンスごとにずれる）
 */
const FILE = join(tmpdir(), "topicstream-nu-live.json");

let memory: LiveState = { extraFavorites: {}, topicScores: {}, shares: {} };
let loaded = false;

function load(): LiveState {
  if (loaded) return memory;
  loaded = true;
  try {
    memory = JSON.parse(readFileSync(FILE, "utf8")) as LiveState;
    memory.extraFavorites ??= {};
    memory.topicScores ??= {};
    memory.shares ??= {};
  } catch {
    memory = { extraFavorites: {}, topicScores: {}, shares: {} };
  }
  return memory;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

/** まとめて書く（票のたびに全部を書き直さない） */
function persist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      mkdirSync(tmpdir(), { recursive: true });
      writeFileSync(FILE, JSON.stringify(memory));
    } catch {
      /* 読み取り専用の環境ではメモリだけ使う */
    }
  }, 2_000);
}

/** 人気のお題・同梱ボードの ♡ の読み直し間隔（Redis のコマンド数を抑える） */
const SCORE_CACHE_MS = 60_000;
const KEY_TOPICS = "ts:topics";
const KEY_FAVORITES = "ts:fav";

type Scores = { topics: Record<string, number>; favorites: Record<string, number> };
let scoreCache: (Scores & { at: number }) | null = null;

/** Redis の [名前, 数, 名前, 数, …] を辞書にする */
function parseFlat(flat: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!Array.isArray(flat)) return out;
  for (let index = 0; index + 1 < flat.length; index += 2) {
    const score = Number(flat[index + 1]);
    if (Number.isFinite(score)) out[String(flat[index])] = score;
  }
  return out;
}

async function loadScores(): Promise<Scores> {
  const config = redisConfig();
  if (!config) {
    const live = load();
    return { topics: live.topicScores, favorites: live.extraFavorites };
  }
  if (scoreCache && Date.now() - scoreCache.at < SCORE_CACHE_MS) return scoreCache;
  try {
    const [topics, favorites] = await Promise.all([
      redisCommand(config, ["ZREVRANGE", KEY_TOPICS, 0, 99, "WITHSCORES"]),
      redisCommand(config, ["HGETALL", KEY_FAVORITES]),
    ]);
    scoreCache = { at: Date.now(), topics: parseFlat(topics), favorites: parseFlat(favorites) };
    return scoreCache;
  } catch {
    return scoreCache ?? { topics: {}, favorites: {} };
  }
}

export async function listCatalog(query = ""): Promise<CatalogBoard[]> {
  const { favorites } = await loadScores();
  const boards = SEED_CATALOG.map((board) => ({
    ...board,
    favorites: board.favorites + (Object.hasOwn(favorites, board.id) ? favorites[board.id]! : 0),
  })).sort((a, b) => b.favorites - a.favorites);
  return searchCatalog(boards, query);
}

export async function bumpFavorite(id: string, delta: 1 | -1 = 1): Promise<number | null> {
  const seed = SEED_CATALOG.find((board) => board.id === id);
  if (!seed) return null;
  const config = redisConfig();
  if (!config) {
    const live = load();
    live.extraFavorites[id] = Math.max(0, (live.extraFavorites[id] ?? 0) + delta);
    persist();
    return seed.favorites + live.extraFavorites[id];
  }
  try {
    let count = Number(await redisCommand(config, ["HINCRBY", KEY_FAVORITES, id, delta]));
    if (count < 0) {
      await redisCommand(config, ["HSET", KEY_FAVORITES, id, 0]);
      count = 0;
    }
    if (scoreCache) scoreCache.favorites[id] = count;
    return seed.favorites + count;
  } catch {
    return seed.favorites;
  }
}

export async function bumpTopic(label: string, kind: string) {
  const weight = kind === "pins" ? 4 : kind === "copies" ? 2 : 3;
  const config = redisConfig();
  if (!config) {
    const live = load();
    const current = Object.hasOwn(live.topicScores, label) ? live.topicScores[label]! : 0;
    live.topicScores[label] = current + weight;
    const labels = Object.keys(live.topicScores);
    if (labels.length > TOPIC_SCORE_LIMIT) {
      const weakest = labels.sort((a, b) => live.topicScores[a]! - live.topicScores[b]!).slice(0, labels.length - TOPIC_SCORE_LIMIT);
      for (const item of weakest) delete live.topicScores[item];
    }
    persist();
    return;
  }
  try {
    await redisCommand(config, ["ZINCRBY", KEY_TOPICS, weight, label]);
    // 弱い語を捨てるのはときどきで足りる（毎回だとコマンドが倍になる）
    if (Math.random() < 0.05) await redisCommand(config, ["ZREMRANGEBYRANK", KEY_TOPICS, 0, -(TOPIC_SCORE_LIMIT + 1)]);
  } catch {
    /* 数えられなくても、人気のお題が少し古いままになるだけ */
  }
}

export async function popularTopics(limit = 12): Promise<PopularTopic[]> {
  const { topics } = await loadScores();
  const map = new Map<string, number>();
  for (const item of SEED_TOPIC_SCORES) map.set(item.label, item.score);
  for (const [label, score] of Object.entries(topics)) {
    map.set(label, (map.get(label) ?? 0) + score);
  }
  return [...map.entries()]
    .map(([label, score]) => ({ label, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * 共有ボード。最後に書き換えてから 180 日で消える（配信のたびに書き換わるので、使っているリンクは消えない）。
 * Redis があれば手元には持たない（大きいボードでメモリを圧迫しない）
 */
const shareKey = (id: string) => `ts:share:${id}`;
const SHARE_TTL_SECONDS = 180 * 24 * 60 * 60;

/** 共有 ID の形（URL に載る） */
export const SHARE_ID_PATTERN = /^[a-zA-Z0-9_-]{6,40}$/;
const SHARE_KEY_PATTERN = /^[a-f0-9]{32,64}$/;

/** owner: 書き換えてよい人の鍵のハッシュ。見る人には返さない。chat: 配信のコメントを読んでいる（見る画面にコメントでできることを出す） */
type Share = { board: Board; nickname: string; updatedAt: number; chat?: boolean; owner?: string };
export type PublicShare = Omit<Share, "owner">;

export type SaveShareResult =
  | { ok: true; id: string; key: string }
  | { ok: false; reason: "forbidden" | "storage" | "limited" };

function hashKey(key: string): string {
  return createHash("sha256").update(`share:${key}`).digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function newShareId(): string {
  return `watch_${randomBytes(12).toString("base64url")}`;
}

/** Redis があるのに読めないときは投げる（「無い」とみなすと、他人がその ID の持ち主として作り直せてしまう） */
async function readShare(id: string): Promise<Share | null> {
  const config = redisConfig();
  if (!config) {
    const live = load();
    return Object.hasOwn(live.shares, id) ? live.shares[id]! : null;
  }
  const raw = await redisCommand(config, ["GET", shareKey(id)]);
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as Share;
  } catch {
    return null;
  }
}

/** いっしょに見るリンクの持ち主か（配信一覧の枠に、そのリンクを付けてよいか） */
export async function isShareOwner(id: string, key: string): Promise<boolean> {
  if (!SHARE_ID_PATTERN.test(id) || !SHARE_KEY_PATTERN.test(key)) return false;
  const share = await readShare(id).catch(() => null);
  return Boolean(share?.owner && sameHash(share.owner, hashKey(key)));
}

/**
 * 共有ボードを保存する。最初に作った人には鍵を渡し、以後の書き換えはその鍵を持つ人だけ
 * （リンクを知っている視聴者が、配信者のボードを差し替えられないように）。
 * allowCreate: 新しく作るときだけ呼ぶ（1 人で共有を大量に作れないよう、呼ぶ側で数える）
 */
export async function saveShare(input: {
  id: string | null;
  key: string | null;
  board: Board;
  nickname: string;
  chat?: boolean;
  allowCreate?: () => boolean;
}): Promise<SaveShareResult> {
  const requestedId = input.id && SHARE_ID_PATTERN.test(input.id) ? input.id : null;
  const requestedKey = input.key && SHARE_KEY_PATTERN.test(input.key) ? input.key : null;
  let existing: Share | null;
  try {
    existing = requestedId ? await readShare(requestedId) : null;
  } catch {
    return { ok: false, reason: "storage" };
  }
  if (existing?.owner && (!requestedKey || !sameHash(existing.owner, hashKey(requestedKey)))) {
    return { ok: false, reason: "forbidden" };
  }
  if (!existing && input.allowCreate && !input.allowCreate()) return { ok: false, reason: "limited" };
  // 鍵の無い古い共有・期限で消えた共有は、送ってきた人を持ち主にして続ける
  const id = requestedId ?? newShareId();
  const key = requestedKey ?? randomBytes(24).toString("hex");
  const share: Share = {
    board: input.board,
    nickname: input.nickname,
    updatedAt: Date.now(),
    chat: input.chat === true,
    owner: hashKey(key),
  };
  const config = redisConfig();
  if (!config) {
    const live = load();
    live.shares[id] = share;
    const ids = Object.keys(live.shares);
    if (ids.length > SHARE_MEMORY_LIMIT) {
      const oldest = ids.sort((a, b) => live.shares[a]!.updatedAt - live.shares[b]!.updatedAt).slice(0, ids.length - SHARE_MEMORY_LIMIT);
      for (const item of oldest) delete live.shares[item];
    }
    persist();
    return { ok: true, id, key };
  }
  try {
    // 新しく作るときは NX（同時に同じ ID で作られても、先に作った人のものを上書きしない）
    const command: (string | number)[] = ["SET", shareKey(id), JSON.stringify(share), "EX", SHARE_TTL_SECONDS];
    const result = await redisCommand(config, existing ? command : [...command, "NX"]);
    if (result === null) return { ok: false, reason: "forbidden" };
    return { ok: true, id, key };
  } catch {
    // ほかのサーバー（インスタンス）から読めないので、見る人には届かない
    return { ok: false, reason: "storage" };
  }
}

/** 無ければ null。保存先が読めないときは投げる（呼ぶ側で「一時的に読めない」と返す） */
export async function getShare(id: string): Promise<PublicShare | null> {
  if (!SHARE_ID_PATTERN.test(id)) return null;
  const share = await readShare(id);
  if (!share) return null;
  return { board: share.board, nickname: share.nickname, updatedAt: share.updatedAt, chat: share.chat === true };
}
