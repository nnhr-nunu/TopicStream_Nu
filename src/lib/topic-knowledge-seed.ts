import { THEME_MAP } from "@/lib/mock-topics";
import { recordTopics, type KnowledgeStore } from "@/lib/topic-knowledge";
import { SEED_MODE_TOPICS, SEED_TOPICS } from "@/lib/topic-knowledge-seed-data";
import type { BoardMode } from "@/lib/types";

/**
 * 同梱の初期データ。キーの無い公開版でもこれと自分の記録で候補が出せる。
 * 初期データの語は2回出たものとして扱う（みんなの記録が1回ずつ増えても埋もれすぎないように）。
 * 雑談以外のモード（お悩み相談など）も、スターターごとに入れてある（図鑑のタブが空にならない）。
 */
export function buildSeedKnowledge(): KnowledgeStore {
  let store: KnowledgeStore = {};
  const sources: [string, string[]][] = [
    ...Object.entries(THEME_MAP),
    ...Object.entries(SEED_TOPICS),
  ];
  for (const [seed, topics] of sources) store = recordTopics(store, seed, topics, 0, 2);
  for (const [mode, seeds] of Object.entries(SEED_MODE_TOPICS) as [BoardMode, Record<string, string[]>][]) {
    for (const [seed, topics] of Object.entries(seeds)) store = recordTopics(store, seed, topics, 0, 2, mode);
  }
  return store;
}

let cached: KnowledgeStore | null = null;

export function seedKnowledge(): KnowledgeStore {
  cached ??= buildSeedKnowledge();
  return cached;
}
