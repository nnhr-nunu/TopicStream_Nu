import type { BoardMode } from "@/lib/types";
import {
  entryMode,
  knowledgeKey,
  mergeStores,
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
 * - お悩み相談などのモードも同じモードの指示で育てる。語が少ないうちに埋もれないよう、枠の一部を先に回す。
 *   ただし切り口（「本当はどうしたい？」など）は元のお題しだいなので、お題としては先に広げない
 */

/** 1つのお題にこれだけたまったら、育てるのは後回し */
export const GROW_TARGET = 24;
/** 1回の枠のうち、雑談以外のモードへ先に回す割合 */
export const GROW_OTHER_SHARE = 1 / 3;

export type GrowCandidate = {
  seed: string;
  mode: BoardMode;
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
    const key = knowledgeKey(candidate.seed, candidate.mode);
    const current = byKey.get(key);
    if (!key || (current && current.priority >= candidate.priority)) return;
    byKey.set(key, candidate);
  };

  for (const entry of Object.values(merged)) {
    const mode = entryMode(entry);
    const depth = Object.keys(entry.topics).length;
    const picks = Object.values(entry.picks ?? {}).reduce((sum, value) => sum + value, 0);
    if (depth < GROW_TARGET) {
      offer({
        seed: entry.seed,
        mode,
        known: rankedTopics(entry),
        priority: (depth < 12 ? 3 : 1) + Math.log2(1 + picks + entry.uses) * 0.5 + random() * 0.5,
      });
    }
    // よく選ばれる語を、次のお題として先に広げておく（雑談だけ）
    if (mode !== "chat") continue;
    for (const label of rankedTopics(entry, 4)) {
      if (merged[knowledgeKey(label)]) continue;
      offer({
        seed: label,
        mode,
        known: [entry.seed],
        priority: 2 + Math.log2(1 + (entry.picks?.[label] ?? 0) + topicScore(entry, label) / 4) * 0.8 + random() * 0.5,
      });
    }
  }

  const sorted = [...byKey.values()].sort((a, b) => b.priority - a.priority);
  const others = sorted.filter((item) => item.mode !== "chat").slice(0, Math.ceil(limit * GROW_OTHER_SHARE));
  const rest = sorted.filter((item) => !others.includes(item)).slice(0, limit - others.length);
  return [...others, ...rest].sort((a, b) => b.priority - a.priority);
}
