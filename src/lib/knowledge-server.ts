import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { LABEL_MAX, ROOT_LABEL_MAX } from "@/lib/constants";
import { sanitizeSecret } from "@/lib/env-secret";
import { isJunkTopic } from "@/lib/gemini-core";
import {
  classifyTopic,
  normalizeSeed,
  recordTopics,
  type KnowledgeEntry,
  type KnowledgeStore,
} from "@/lib/topic-knowledge";

/**
 * みんなの図鑑（サーバー専用）。AI が作った語だけを記録する（利用者からの書き込み口は作らない）。
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
  redis.call('HDEL', 'tsk:seed', low[1])
  redis.call('HDEL', 'tsk:updated', low[1])
end
return 1
`;

/** よく使われるお題から順に、中身ごとまとめて読む */
const SNAPSHOT_SCRIPT = `
local keys = redis.call('ZREVRANGE', 'tsk:uses', 0, tonumber(ARGV[1]) - 1, 'WITHSCORES')
local out = {}
for i = 1, #keys, 2 do
  local k = keys[i]
  table.insert(out, { k, redis.call('HGET', 'tsk:seed', k) or k, keys[i + 1], redis.call('HGET', 'tsk:updated', k) or '0', redis.call('HGETALL', 'tsk:t:' .. k) })
end
return out
`;

function parseSnapshot(raw: unknown): KnowledgeStore {
  const store: KnowledgeStore = {};
  if (!Array.isArray(raw)) return store;
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const [key, seed, uses, updated, flat] = row as [string, string, string, string, unknown];
    if (typeof key !== "string" || !Array.isArray(flat)) continue;
    const topics: Record<string, number> = {};
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const count = Number(flat[i + 1]);
      if (typeof flat[i] === "string" && count > 0) topics[flat[i] as string] = count;
    }
    if (Object.keys(topics).length === 0) continue;
    store[key] = {
      seed: String(seed),
      category: classifyTopic(String(seed), Object.keys(topics)),
      topics,
      uses: Number(uses) || 1,
      updatedAt: Number(updated) || 0,
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

/** 記録に値する語だけに絞る（長すぎる・壊れた語・お題そのものは入れない） */
export function cleanForRecord(seed: string, topics: string[]): { seed: string; topics: string[] } | null {
  const trimmed = seed.trim();
  if (!trimmed || trimmed.length > ROOT_LABEL_MAX) return null;
  const key = normalizeSeed(trimmed);
  const cleaned = [
    ...new Set(
      topics
        .map((label) => label.trim())
        .filter((label) => label && label.length <= LABEL_MAX && !isJunkTopic(label) && normalizeSeed(label) !== key),
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

/** 図鑑に載せてよいか。1回しか使われていないお題は、個人的な言葉かもしれないので一覧には出さない */
export function isPublicEntry(entry: KnowledgeEntry): boolean {
  return entry.uses >= 2;
}
