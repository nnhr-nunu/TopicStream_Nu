import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { LABEL_MAX, ROOT_LABEL_MAX } from "@/lib/constants";

/** 票で入る語の長さの上限（自分で書き直した語は少し長いこともある） */
const PICK_TOPIC_MAX = 40;
import { sanitizeSecret } from "@/lib/env-secret";
import { isJunkTopic } from "@/lib/gemini-core";
import { isArchived, withoutArchived } from "@/lib/topic-archive";
import {
  classifyTopic,
  normalizeSeed,
  PICK_WEIGHTS,
  recordPick,
  recordTopics,
  type KnowledgeStore,
  type PickKind,
} from "@/lib/topic-knowledge";

/**
 * みんなの図鑑（サーバー専用）。AI が作った語と、利用者が選んだ語（♡・クリック・ピン・書き直しなど）を記録する。
 * 今はデータ集めを優先して、票の数や回数は絞っていない（URL・連絡先らしき語だけ捨てる）。
 *
 * Upstash Redis（Vercel の Marketplace から入れると KV_REST_API_URL / KV_REST_API_TOKEN が入る）があればそこへ。
 * 無ければインスタンスのメモリと一時ファイルだけ（開発用。Vercel では再起動で消える）。
 */

/** 記録するお題の数の上限（使われた回数の少ないものから消す） */
const SEED_LIMIT = 5_000;
/** 1つのお題に持たせる語の上限 */
const TOPIC_LIMIT = 80;
/** 読み込むお題の数と、読み直す間隔（Redis のコマンド数を抑える） */
const SNAPSHOT_SIZE = 500;
const SNAPSHOT_TTL_MS = 3 * 60_000;

type Redis = { url: string; token: string };

function redisConfig(): Redis | null {
  const url = sanitizeSecret(process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL);
  const token = sanitizeSecret(process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN);
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function redisCommand(config: Redis, command: (string | number)[]): Promise<unknown> {
  const response = await fetch(config.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(3_000),
  });
  const json = (await response.json().catch(() => null)) as { result?: unknown; error?: string } | null;
  if (!response.ok || !json || json.error) throw new Error(json?.error ?? `redis ${response.status}`);
  return json.result;
}

/** お題が多すぎたら、強さ（tsk:rank）のいちばん弱いものから消す */
const EVICT = `
while redis.call('ZCARD', 'tsk:rank') > ${SEED_LIMIT} do
  local low = redis.call('ZPOPMIN', 'tsk:rank')
  redis.call('ZREM', 'tsk:uses', low[1])
  redis.call('DEL', 'tsk:t:' .. low[1])
  redis.call('DEL', 'tsk:p:' .. low[1])
  redis.call('HDEL', 'tsk:seed', low[1])
  redis.call('HDEL', 'tsk:updated', low[1])
end
`;

/**
 * 1回の記録を1コマンドで（無料枠のコマンド数を節約）。
 * tsk:uses は「何回広げられたか」の表示用、tsk:rank は並び順と追い出しに使う強さ（使われた回数 + 票）。
 */
const RECORD_SCRIPT = `
local key = ARGV[1]
redis.call('HSETNX', 'tsk:seed', key, ARGV[2])
redis.call('ZINCRBY', 'tsk:uses', 1, key)
redis.call('ZINCRBY', 'tsk:rank', 1, key)
redis.call('HSET', 'tsk:updated', key, ARGV[3])
local hash = 'tsk:t:' .. key
for i = 5, #ARGV do
  if redis.call('HEXISTS', hash, ARGV[i]) == 1 or redis.call('HLEN', hash) < tonumber(ARGV[4]) then
    redis.call('HINCRBY', hash, ARGV[i], 1)
  end
end
${EVICT}
return 1
`;

/**
 * 選ばれた語の票をまとめて入れる。ARGV[1]=時刻、そのあと (お題のキー, 表示用のお題, 語, 重み) の4つ組が続く。
 * 図鑑にまだ無いお題・語は、その場で1回出たものとして加える（盛り上がった話題を取りこぼさない）。
 */
const PICK_SCRIPT = `
local now = ARGV[1]
local n = 0
for i = 2, #ARGV - 3, 4 do
  local key = ARGV[i]
  local topic = ARGV[i + 2]
  local weight = tonumber(ARGV[i + 3])
  redis.call('ZADD', 'tsk:uses', 'NX', 1, key)
  redis.call('HSETNX', 'tsk:seed', key, ARGV[i + 1])
  redis.call('HSET', 'tsk:updated', key, now)
  if redis.call('HEXISTS', 'tsk:t:' .. key, topic) == 0 then
    redis.call('HSET', 'tsk:t:' .. key, topic, 1)
  end
  redis.call('HINCRBY', 'tsk:p:' .. key, topic, weight)
  redis.call('ZINCRBY', 'tsk:rank', weight, key)
  n = n + 1
end
${EVICT}
return n
`;

/** 強い（よく使われ、よく選ばれた）お題から順に、中身ごとまとめて読む */
const SNAPSHOT_SCRIPT = `
if redis.call('EXISTS', 'tsk:rank') == 0 then redis.call('ZUNIONSTORE', 'tsk:rank', 1, 'tsk:uses') end
local keys = redis.call('ZREVRANGE', 'tsk:rank', 0, tonumber(ARGV[1]) - 1)
local out = {}
for i = 1, #keys do
  local k = keys[i]
  table.insert(out, { k, redis.call('HGET', 'tsk:seed', k) or k, redis.call('ZSCORE', 'tsk:uses', k) or '1', redis.call('HGET', 'tsk:updated', k) or '0', redis.call('HGETALL', 'tsk:t:' .. k), redis.call('HGETALL', 'tsk:p:' .. k) })
end
return out
`;

/** 1つのお題だけ読む（よく使われる順の読み込みに入らない、まだ少ないお題のため） */
const ENTRY_SCRIPT = `
local k = ARGV[1]
local score = redis.call('ZSCORE', 'tsk:uses', k)
if not score then return {} end
return { { k, redis.call('HGET', 'tsk:seed', k) or k, score, redis.call('HGET', 'tsk:updated', k) or '0', redis.call('HGETALL', 'tsk:t:' .. k), redis.call('HGETALL', 'tsk:p:' .. k) } }
`;

function hashToCounts(flat: unknown[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const count = Number(flat[i + 1]);
    if (typeof flat[i] === "string" && count > 0) out[flat[i] as string] = count;
  }
  return out;
}

function parseSnapshot(raw: unknown): KnowledgeStore {
  const store: KnowledgeStore = {};
  if (!Array.isArray(raw)) return store;
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const [key, seed, uses, updated, flat, flatPicks] = row as [string, string, string, string, unknown, unknown];
    if (typeof key !== "string" || !Array.isArray(flat)) continue;
    const topics = hashToCounts(flat);
    if (Object.keys(topics).length === 0) continue;
    const picks = Array.isArray(flatPicks) ? hashToCounts(flatPicks) : {};
    store[key] = {
      seed: String(seed),
      category: classifyTopic(String(seed), Object.keys(topics)),
      topics,
      uses: Number(uses) || 1,
      updatedAt: Number(updated) || 0,
      ...(Object.keys(picks).length ? { picks } : {}),
    };
  }
  return store;
}

// ---- Redis が無いときの置き場（live-store と同じく一時ファイル） ----

const FILE = join(tmpdir(), "topicstream-nu-knowledge.json");
let memory: KnowledgeStore | null = null;

function loadMemory(): KnowledgeStore {
  if (memory) return memory;
  try {
    memory = JSON.parse(readFileSync(FILE, "utf8")) as KnowledgeStore;
  } catch {
    memory = {};
  }
  return memory;
}

function persistMemory() {
  try {
    mkdirSync(tmpdir(), { recursive: true });
    writeFileSync(FILE, JSON.stringify(memory));
  } catch {
    /* 読み取り専用の環境ではメモリだけ */
  }
}

// ---- 読み込みのキャッシュ ----

let snapshot: { store: KnowledgeStore; at: number } | null = null;

export function knowledgeBackend(): "redis" | "memory" {
  return redisConfig() ? "redis" : "memory";
}

/** みんなの図鑑をまるごと（よく使われる順に最大 SNAPSHOT_SIZE 件）読む */
export async function loadSharedKnowledge(): Promise<KnowledgeStore> {
  const config = redisConfig();
  if (!config) return withoutArchived(loadMemory());
  if (snapshot && Date.now() - snapshot.at < SNAPSHOT_TTL_MS) return snapshot.store;
  try {
    // アーカイブした語は Redis に残したまま、読むときに外す
    const store = withoutArchived(parseSnapshot(await redisCommand(config, ["EVAL", SNAPSHOT_SCRIPT, 0, SNAPSHOT_SIZE])));
    snapshot = { store, at: Date.now() };
    return store;
  } catch (error) {
    console.warn("[knowledge] snapshot", error instanceof Error ? error.message : error);
    // 読めないときは前回の分（無ければ空）で続ける
    return snapshot?.store ?? {};
  }
}

/** 連絡先・URL・@ハンドルなど、個人につながりそうな文字列。図鑑には入れない */
const PERSONAL_PATTERN =
  /(https?:\/\/|www\.|[\w.+-]+@[\w-]+\.|@[A-Za-z0-9_]{3,}|\d{2,4}-\d{2,4}-\d{3,4}|\d{10,}|〒\s*\d{3}-?\d{4})/;

export function looksPersonal(text: string): boolean {
  return PERSONAL_PATTERN.test(text.normalize("NFKC"));
}

/** みんなの図鑑に、そのお題そのものも確実に入れて返す */
export async function loadSharedFor(seed: string): Promise<KnowledgeStore> {
  const store = await loadSharedKnowledge();
  const key = normalizeSeed(seed);
  const config = redisConfig();
  if (!key || store[key] || !config) return store;
  try {
    const found = withoutArchived(parseSnapshot(await redisCommand(config, ["EVAL", ENTRY_SCRIPT, 0, key])));
    return found[key] ? { ...store, [key]: found[key]! } : store;
  } catch {
    return store;
  }
}

/** 記録に値する語だけに絞る（長すぎる・壊れた語・お題そのもの・個人につながりそうな語は入れない） */
export function cleanForRecord(seed: string, topics: string[]): { seed: string; topics: string[] } | null {
  const trimmed = seed.trim();
  if (!trimmed || trimmed.length > ROOT_LABEL_MAX || looksPersonal(trimmed)) return null;
  const key = normalizeSeed(trimmed);
  const cleaned = [
    ...new Set(
      topics
        .map((label) => label.trim())
        .filter(
          (label) =>
            label &&
            label.length <= LABEL_MAX &&
            !isJunkTopic(label) &&
            !looksPersonal(label) &&
            !isArchived(trimmed, label) &&
            normalizeSeed(label) !== key,
        ),
    ),
  ].slice(0, 16);
  return cleaned.length > 0 ? { seed: trimmed, topics: cleaned } : null;
}

/** AI の結果を1回分記録する。失敗しても生成そのものは止めない */
export async function recordSharedKnowledge(seed: string, topics: string[]): Promise<void> {
  const cleaned = cleanForRecord(seed, topics);
  if (!cleaned) return;
  const now = Date.now();
  // 読み込み済みの分にもすぐ反映して、同じインスタンスでは次の問い合わせから使えるようにする
  if (snapshot) snapshot.store = recordTopics(snapshot.store, cleaned.seed, cleaned.topics, now);
  const config = redisConfig();
  if (!config) {
    memory = recordTopics(loadMemory(), cleaned.seed, cleaned.topics, now);
    persistMemory();
    return;
  }
  try {
    await redisCommand(config, [
      "EVAL",
      RECORD_SCRIPT,
      0,
      normalizeSeed(cleaned.seed),
      cleaned.seed,
      now,
      TOPIC_LIMIT,
      ...cleaned.topics,
    ]);
  } catch (error) {
    console.warn("[knowledge] record", error instanceof Error ? error.message : error);
  }
}

export type SharedPick = { seed: string; topic: string; kind: PickKind };

/** 票として受け付ける形にそろえる（長すぎる語・個人につながりそうな語は捨てる） */
export function cleanPick(pick: SharedPick): SharedPick | null {
  const seed = pick.seed.trim();
  const topic = pick.topic.trim();
  if (!seed || !topic || seed.length > ROOT_LABEL_MAX || topic.length > PICK_TOPIC_MAX) return null;
  if (isJunkTopic(topic) || looksPersonal(seed) || looksPersonal(topic)) return null;
  if (normalizeSeed(seed) === normalizeSeed(topic) || isArchived(seed, topic)) return null;
  return { seed, topic, kind: pick.kind };
}

/** 選ばれた語（♡・クリック・ピン・コピー・書き直し・コメントのハート）をまとめて記録する。記録できた数を返す */
export async function recordSharedPicks(picks: SharedPick[]): Promise<number> {
  const cleaned = picks.map(cleanPick).filter((pick): pick is SharedPick => pick !== null);
  if (cleaned.length === 0) return 0;
  const now = Date.now();
  const apply = (store: KnowledgeStore) =>
    cleaned.reduce((acc, pick) => recordPick(acc, pick.seed, pick.topic, pick.kind, now), store);
  if (snapshot) snapshot.store = apply(snapshot.store);
  const config = redisConfig();
  if (!config) {
    memory = apply(loadMemory());
    persistMemory();
    return cleaned.length;
  }
  try {
    const args = cleaned.flatMap((pick) => [normalizeSeed(pick.seed), pick.seed, pick.topic, PICK_WEIGHTS[pick.kind]]);
    return Number(await redisCommand(config, ["EVAL", PICK_SCRIPT, 0, now, ...args])) || 0;
  } catch (error) {
    console.warn("[knowledge] pick", error instanceof Error ? error.message : error);
    return 0;
  }
}
