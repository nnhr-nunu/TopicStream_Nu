import {
  mergeStores,
  normalizeSeed,
  rankedTopics,
  topicScore,
  type KnowledgeStore,
} from "@/lib/topic-knowledge";

/**
 * 図鑑を育てる順番を決める（毎日の自動実行と、公開前のまとめ実行で使う）。
 *
 * - 語がまだ少ないお題ほど先に（1つのお題に GROW_TARGET 語たまったら後回し）
 * - よく選ばれている語（♡・クリック）は、それ自体をお題として先に広げておく
 *   （アプリでカードを押すと、その語がお題になって AI に頼むので、先に図鑑に入れておけば AI を呼ばずに済む）
 */

/** 1つのお題にこれだけたまったら、育てるのは後回し */
export const GROW_TARGET = 24;

export type GrowCandidate = {
  seed: string;
  /** すでに図鑑にある語（AI に「これ以外で」と頼む） */
  known: string[];
  priority: number;
};

export function pickGrowCandidates(
  bundled: KnowledgeStore,
  shared: KnowledgeStore,
  limit: number,
  random: () => number = Math.random,
): GrowCandidate[] {
  const merged = mergeStores(bundled, shared);
  const byKey = new Map<string, GrowCandidate>();
  const offer = (candidate: GrowCandidate) => {
    const key = normalizeSeed(candidate.seed);
    const current = byKey.get(key);
    if (!key || (current && current.priority >= candidate.priority)) return;
    byKey.set(key, candidate);
  };

  for (const entry of Object.values(merged)) {
    const depth = Object.keys(entry.topics).length;
    const picks = Object.values(entry.picks ?? {}).reduce((sum, value) => sum + value, 0);
    if (depth < GROW_TARGET) {
      offer({
        seed: entry.seed,
        known: rankedTopics(entry),
        priority: (depth < 12 ? 3 : 1) + Math.log2(1 + picks + entry.uses) * 0.5 + random() * 0.5,
      });
    }
    // よく選ばれる語を、次のお題として先に広げておく
    for (const label of rankedTopics(entry, 4)) {
      if (merged[normalizeSeed(label)]) continue;
      offer({
        seed: label,
        known: [entry.seed],
        priority: 2 + Math.log2(1 + (entry.picks?.[label] ?? 0) + topicScore(entry, label) / 4) * 0.8 + random() * 0.5,
      });
    }
  }

  return [...byKey.values()].sort((a, b) => b.priority - a.priority).slice(0, limit);
}
