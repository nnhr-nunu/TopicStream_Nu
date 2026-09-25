import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { LABEL_MAX, ROOT_LABEL_MAX } from "@/lib/constants";
import { sanitizeSecret } from "@/lib/env-secret";
import { isJunkTopic } from "@/lib/gemini-core";
import {
  classifyTopic,
  normalizeSeed,
  PICK_WEIGHTS,
  recordPick,
  recordTopics,
  type KnowledgeStore,
  type PickKind,
} from "@/lib/topic-knowledge";
import { seedKnowledge } from "@/lib/topic-knowledge-seed";

/**
 * みんなの図鑑（サーバー専用）。新しい文言は AI が作った語だけを記録する。
 * 利用者から届くのは「図鑑にある語が選ばれた」という票だけ（新しい文言は入れられない）。
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

/** 1回の記録を1コマンドで（無料枠のコマンド数を節約） */
const RECORD_SCRIPT = `
local key = ARGV[1]
redis.call('HSETNX', 'tsk:seed', key, ARGV[2])
redis.call('ZINCRBY', 'tsk:uses', 1, key)
redis.call('HSET', 'tsk:updated', key, ARGV[3])
local hash = 'tsk:t:' .. key
for i = 5, #ARGV do
  if redis.call('HEXISTS', hash, ARGV[i]) == 1 or redis.call('HLEN', hash) < tonumber(ARGV[4]) then
    redis.call('HINCRBY', hash, ARGV[i], 1)
  end
end
while redis.call('ZCARD', 'tsk:uses') > ${SEED_LIMIT} do
  local low = redis.call('ZPOPMIN', 'tsk:uses')
  redis.call('DEL', 'tsk:t:' .. low[1])
  redis.call('DEL', 'tsk:p:' .. low[1])
  redis.call('HDEL', 'tsk:seed', low[1])
  redis.call('HDEL', 'tsk:updated', low[1])
end
return 1
`;

/**
 * 図鑑にある語だけに票を入れる。ARGV[4] が '1' のときは同梱の初期データにある語なので、
 * まだ Redis に無ければそのお題ごと入れてから票を入れる。
 */
const PICK_SCRIPT = `
local key = ARGV[1]
if redis.call('HEXISTS', 'tsk:t:' .. key, ARGV[2]) == 0 then
  if ARGV[4] ~= '1' then return 0 end
  redis.call('HSETNX', 'tsk:seed', key, ARGV[5])
  redis.call('ZADD', 'tsk:uses', 'NX', 1, key)
  redis.call('HSET', 'tsk:updated', key, ARGV[6])
  redis.call('HINCRBY', 'tsk:t:' .. key, ARGV[2], 1)
end
redis.call('HINCRBY', 'tsk:p:' .. key, ARGV[2], tonumber(ARGV[3]))
return 1
`;

/** よく使われるお題から順に、中身ごとまとめて読む */
const SNAPSHOT_SCRIPT = `
local keys = redis.call('ZREVRANGE', 'tsk:uses', 0, tonumber(ARGV[1]) - 1, 'WITHSCORES')
local out = {}
for i = 1, #keys, 2 do
  local k = keys[i]
  table.insert(out, { k, redis.call('HGET', 'tsk:seed', k) or k, keys[i + 1], redis.call('HGET', 'tsk:updated', k) or '0', redis.call('HGETALL', 'tsk:t:' .. k), redis.call('HGETALL', 'tsk:p:' .. k) })
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
  if (!config) return loadMemory();
  if (snapshot && Date.now() - snapshot.at < SNAPSHOT_TTL_MS) return snapshot.store;
  try {
    const store = parseSnapshot(await redisCommand(config, ["EVAL", SNAPSHOT_SCRIPT, 0, SNAPSHOT_SIZE]));
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
    const found = parseSnapshot(await redisCommand(config, ["EVAL", ENTRY_SCRIPT, 0, key]));
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

/** 図鑑にある語が選ばれた（♡・クリック・ピンなど）。図鑑に無い語は無視する */
export async function recordSharedPick(seed: string, topic: string, kind: PickKind): Promise<boolean> {
  const key = normalizeSeed(seed);
  if (!key || !topic.trim()) return false;
  const bundled = seedKnowledge()[key];
  const fromBundle = Boolean(bundled && topic in bundled.topics);
  // 同梱の語は、まだみんなの図鑑に無ければ1回出たものとして入れてから票を入れる
  const ensure = (store: KnowledgeStore) =>
    fromBundle && !(store[key] && topic in store[key]!.topics) ? recordTopics(store, bundled!.seed, [topic]) : store;
  if (snapshot) snapshot.store = recordPick(ensure(snapshot.store), seed, topic, kind);
  const config = redisConfig();
  if (!config) {
    const before = loadMemory();
    memory = recordPick(ensure(before), seed, topic, kind);
    if (memory === before) return false;
    persistMemory();
    return true;
  }
  try {
    const result = await redisCommand(config, [
      "EVAL",
      PICK_SCRIPT,
      0,
      key,
      topic,
      PICK_WEIGHTS[kind],
      fromBundle ? "1" : "0",
      bundled?.seed ?? seed,
      Date.now(),
    ]);
    return result === 1;
  } catch (error) {
    console.warn("[knowledge] pick", error instanceof Error ? error.message : error);
    return false;
  }
}
