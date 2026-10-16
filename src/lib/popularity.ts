import { rankedLocalTopics, usageScore, type TopicUsage } from "@/lib/usage";
import { SEED_TOPIC_SCORES, type PopularTopic } from "@/lib/catalog-data";
import { MONTHLY_TOPICS, STARTER_TOPICS, pickRandomStarter } from "@/lib/starters";

export type { PopularTopic };

/**
 * サーバーの人気のお題（remote）に、この端末でよく使ったお題を足して並べる。
 * サーバーの答えには手書きの初期点数がもう入っているので、足すのは読めなかったとき（remote が空）だけ
 */
export function mergePopularTopics(remote: PopularTopic[] = [], limit = 12): PopularTopic[] {
  const map = new Map<string, number>();
  if (remote.length === 0) for (const item of SEED_TOPIC_SCORES) map.set(item.label, item.score);
  for (const item of remote) map.set(item.label, (map.get(item.label) ?? 0) + item.score);
  for (const local of rankedLocalTopics(40) as TopicUsage[]) {
    map.set(local.label, (map.get(local.label) ?? 0) + usageScore(local));
  }
  return [...map.entries()]
    .map(([label, score]) => ({ label, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** 今月のお題を先頭に混ぜる（同じお題は二重に出さない） */
export function withMonthlyTopics(popular: PopularTopic[], monthly: string[], limit = 12): PopularTopic[] {
  const scores = new Map(popular.map((item) => [item.label, item.score]));
  const first = monthly.map((label) => ({ label, score: scores.get(label) ?? 0 }));
  return [...first, ...popular.filter((item) => !monthly.includes(item.label))].slice(0, limit);
}

export function pickWeightedStarter(exclude: string[] = [], now = new Date()): string {
  const ranked = mergePopularTopics([], 24);
  const seen = new Set(ranked.map((item) => item.label));
  const monthly = (MONTHLY_TOPICS[now.getMonth() + 1] ?? []).filter((label) => !exclude.includes(label) && !seen.has(label));
  const pool: PopularTopic[] = [
    ...ranked.filter((item) => !exclude.includes(item.label)),
    ...monthly.map((label) => ({ label, score: 40 })),
    ...STARTER_TOPICS.filter((label) => !exclude.includes(label) && !seen.has(label) && !monthly.includes(label)).map((label) => ({
      label,
      score: 28,
    })),
  ];
  if (pool.length === 0) return pickRandomStarter(exclude);
  const total = pool.reduce((sum, item) => sum + Math.max(item.score, 1), 0);
  let cursor = Math.random() * total;
  for (const item of pool) {
    cursor -= Math.max(item.score, 1);
    if (cursor <= 0) return item.label;
  }
  return pool[0]?.label ?? pickRandomStarter(exclude);
}

export function preferredForSeed(seed: string): string[] {
  const local = rankedLocalTopics(24).map((item) => item.label).filter((label) => label !== seed);
  const starters = STARTER_TOPICS.filter((topic) => topic !== seed);
  return [...local, ...starters].slice(0, 8);
}
