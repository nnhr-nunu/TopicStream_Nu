import { THEME_MAP } from "@/lib/mock-topics";
import { recordTopics, type KnowledgeStore } from "@/lib/topic-knowledge";
import { SEED_TOPICS } from "@/lib/topic-knowledge-seed-data";

/**
 * 同梱の初期データ。キーの無い公開版でもこれと自分の記録で候補が出せる。
 * 初期データの語は2回出たものとして扱う（みんなの記録が1回ずつ増えても埋もれすぎないように）。
 */
export function buildSeedKnowledge(): KnowledgeStore {
  let store: KnowledgeStore = {};
  const sources: [string, string[]][] = [
    ...Object.entries(THEME_MAP),
    ...Object.entries(SEED_TOPICS),
  ];
  for (const [seed, topics] of sources) store = recordTopics(store, seed, topics, 0, 2);
  return store;
}

let cached: KnowledgeStore | null = null;

export function seedKnowledge(): KnowledgeStore {
  cached ??= buildSeedKnowledge();
  return cached;
}
