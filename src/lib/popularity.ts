import { rankedLocalTopics, usageScore, type TopicUsage } from "@/lib/usage";
import { SEED_TOPIC_SCORES, type PopularTopic } from "@/lib/catalog-data";
import { STARTER_TOPICS, pickRandomStarter } from "@/lib/starters";

export type { PopularTopic };

export function mergePopularTopics(remote: PopularTopic[] = [], limit = 10): PopularTopic[] {
  const map = new Map<string, number>();
  for (const item of SEED_TOPIC_SCORES) map.set(item.label, item.score);
  for (const item of remote) map.set(item.label, (map.get(item.label) ?? 0) + item.score);
  for (const local of rankedLocalTopics(40) as TopicUsage[]) {
    map.set(local.label, (map.get(local.label) ?? 0) + usageScore(local));
  }
  return [...map.entries()]
    .map(([label, score]) => ({ label, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function pickWeightedStarter(exclude: string[] = []): string {
  const ranked = mergePopularTopics([], 16).filter((item) => !exclude.includes(item.label));
  if (ranked.length === 0) return pickRandomStarter(exclude);
  const total = ranked.reduce((sum, item) => sum + Math.max(item.score, 1), 0);
  let cursor = Math.random() * total;
  for (const item of ranked) {
    cursor -= Math.max(item.score, 1);
    if (cursor <= 0) return item.label;
  }
  return ranked[0]?.label ?? pickRandomStarter(exclude);
}

export function preferredForSeed(seed: string): string[] {
  const local = rankedLocalTopics(24).map((item) => item.label).filter((label) => label !== seed);
  const starters = STARTER_TOPICS.filter((topic) => topic !== seed);
  return [...local, ...starters].slice(0, 8);
}
