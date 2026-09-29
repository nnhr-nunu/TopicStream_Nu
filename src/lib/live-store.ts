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
/** Redis が無いときに手元に置く共有ボードの数 */
const SHARE_MEMORY_LIMIT = 300;
export const TOPIC_EVENT_KINDS = ["expands", "pins", "copies"] as const;

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
      /* Vercel などの読み取り専用環境ではメモリだけ使う */
    }
  }, 2_000);
}

export function listCatalog(query = ""): CatalogBoard[] {
  const live = load();
  const boards = SEED_CATALOG.map((board) => ({
    ...board,
    favorites: board.favorites + (live.extraFavorites[board.id] ?? 0),
  })).sort((a, b) => b.favorites - a.favorites);
  return searchCatalog(boards, query);
}

export function bumpFavorite(id: string, delta: 1 | -1 = 1): number | null {
  const seed = SEED_CATALOG.find((board) => board.id === id);
  if (!seed) return null;
  const live = load();
  live.extraFavorites[id] = Math.max(0, (live.extraFavorites[id] ?? 0) + delta);
  persist();
  return seed.favorites + live.extraFavorites[id];
}

export function bumpTopic(label: string, kind: string) {
  const weight = kind === "pins" ? 4 : kind === "copies" ? 2 : 3;
  const live = load();
  const current = Object.hasOwn(live.topicScores, label) ? live.topicScores[label]! : 0;
  live.topicScores[label] = current + weight;
  const labels = Object.keys(live.topicScores);
  if (labels.length > TOPIC_SCORE_LIMIT) {
    const weakest = labels.sort((a, b) => live.topicScores[a]! - live.topicScores[b]!).slice(0, labels.length - TOPIC_SCORE_LIMIT);
    for (const item of weakest) delete live.topicScores[item];
  }
  persist();
}

export function popularTopics(limit = 12): PopularTopic[] {
  const live = load();
  const map = new Map<string, number>();
  for (const item of SEED_TOPIC_SCORES) map.set(item.label, item.score);
  for (const [label, score] of Object.entries(live.topicScores)) {
    map.set(label, (map.get(label) ?? 0) + score);
  }
  return [...map.entries()]
    .map(([label, score]) => ({ label, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** 共有ボードは期限なしで残す。Redis があればサーバーを再起動しても消えない */
const shareKey = (id: string) => `ts:share:${id}`;

/** 共有 ID の形（URL に載る） */
export const SHARE_ID_PATTERN = /^[a-zA-Z0-9_-]{6,40}$/;
const SHARE_KEY_PATTERN = /^[a-f0-9]{32,64}$/;

/** owner: 書き換えてよい人の鍵のハッシュ。見る人には返さない */
type Share = { board: Board; nickname: string; updatedAt: number; owner?: string };
export type PublicShare = Omit<Share, "owner">;

export type SaveShareResult =
  | { ok: true; id: string; key: string }
  | { ok: false; reason: "forbidden" | "storage" };

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

async function readShare(id: string): Promise<Share | null> {
  const live = load();
  const local = Object.hasOwn(live.shares, id) ? live.shares[id]! : null;
  const config = redisConfig();
  if (!config) return local;
  try {
    const raw = await redisCommand(config, ["GET", shareKey(id)]);
    if (typeof raw === "string") return JSON.parse(raw) as Share;
  } catch {
    /* Redis が読めないときは手元の分で返す */
  }
  return local;
}

/**
 * 共有ボードを保存する。最初に作った人には鍵を渡し、以後の書き換えはその鍵を持つ人だけ
 * （リンクを知っている視聴者が、配信者のボードを差し替えられないように）
 */
export async function saveShare(input: {
  id: string | null;
  key: string | null;
  board: Board;
  nickname: string;
}): Promise<SaveShareResult> {
  const requestedId = input.id && SHARE_ID_PATTERN.test(input.id) ? input.id : null;
  const requestedKey = input.key && SHARE_KEY_PATTERN.test(input.key) ? input.key : null;
  const existing = requestedId ? await readShare(requestedId) : null;
  if (existing?.owner && (!requestedKey || !sameHash(existing.owner, hashKey(requestedKey)))) {
    return { ok: false, reason: "forbidden" };
  }
  // 鍵の無い古い共有・消えてしまった共有は、送ってきた人を持ち主にして続ける
  const id = requestedId ?? newShareId();
  const key = requestedKey ?? randomBytes(24).toString("hex");
  const share: Share = { board: input.board, nickname: input.nickname, updatedAt: Date.now(), owner: hashKey(key) };
  const live = load();
  live.shares[id] = share;
  const ids = Object.keys(live.shares);
  if (ids.length > SHARE_MEMORY_LIMIT) {
    const oldest = ids.sort((a, b) => live.shares[a]!.updatedAt - live.shares[b]!.updatedAt).slice(0, ids.length - SHARE_MEMORY_LIMIT);
    for (const item of oldest) delete live.shares[item];
  }
  persist();
  const config = redisConfig();
  if (!config) return { ok: true, id, key };
  try {
    await redisCommand(config, ["SET", shareKey(id), JSON.stringify(share)]);
    return { ok: true, id, key };
  } catch {
    // ほかのサーバー（インスタンス）から読めないので、見る人には届かない
    return { ok: false, reason: "storage" };
  }
}

export async function getShare(id: string): Promise<PublicShare | null> {
  if (!SHARE_ID_PATTERN.test(id)) return null;
  const share = await readShare(id);
  if (!share) return null;
  return { board: share.board, nickname: share.nickname, updatedAt: share.updatedAt };
}
