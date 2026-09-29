import { isPublicSafe } from "@/lib/public-text";
import { ANYWHERE, ARCHIVED_SEEDS, BY_SEED, CATEGORY_FIXES } from "@/lib/topic-archive-data";
import { normalizeSeed, type KnowledgeEntry, type KnowledgeStore } from "@/lib/topic-knowledge";

/**
 * トピック図鑑のアーカイブ。話題として微妙なお題・語を、図鑑に出さない・記録し直さないようにする。
 * みんなの図鑑（Redis）からは消さずに隠すだけなので、ここから外せば元に戻る。中身は topic-archive-data.ts。
 *
 * - ARCHIVED_SEEDS: お題ごと隠す（単独で話し始めにくい・ほかと重なる）
 * - BY_SEED: そのお題の下でだけ語を隠す（お題に合っていない・広がりにくい語）
 * - ANYWHERE: どのお題の下でも語を隠す（文として壊れている語）
 * - CATEGORY_FIXES: 分類の付け直し
 * 個人につながる語・人を傷つける語（public-text.ts）も、記録した時期に関係なくここで隠す。
 */

const archivedSeeds = new Set(ARCHIVED_SEEDS.map(normalizeSeed));
const bySeed = new Map(
  Object.entries(BY_SEED).map(([seed, topics]) => [normalizeSeed(seed), new Set(topics.map(normalizeSeed))]),
);
const anywhere = new Set(ANYWHERE.map(normalizeSeed));
const categoryFixes = new Map(Object.entries(CATEGORY_FIXES).map(([seed, category]) => [normalizeSeed(seed), category]));

export function isArchivedSeed(seed: string): boolean {
  return archivedSeeds.has(normalizeSeed(seed));
}

export function isArchived(seed: string, topic: string): boolean {
  const label = normalizeSeed(topic);
  return anywhere.has(label) || Boolean(bySeed.get(normalizeSeed(seed))?.has(label));
}

function withoutArchivedEntry(entry: KnowledgeEntry): KnowledgeEntry {
  const keep = (label: string) => !isArchived(entry.seed, label) && isPublicSafe(label);
  const topics = Object.fromEntries(Object.entries(entry.topics).filter(([label]) => keep(label)));
  const next: KnowledgeEntry = { ...entry, topics };
  const category = categoryFixes.get(normalizeSeed(entry.seed));
  if (category) next.category = category;
  delete next.picks;
  const picks = Object.fromEntries(Object.entries(entry.picks ?? {}).filter(([label]) => keep(label)));
  if (Object.keys(picks).length > 0) next.picks = picks;
  return next;
}

/** アーカイブしたお題・語と公開に向かない語を除き、分類を直した図鑑（語が1つも残らないお題は出さない） */
export function withoutArchived(store: KnowledgeStore): KnowledgeStore {
  const out: KnowledgeStore = {};
  for (const [key, entry] of Object.entries(store)) {
    if (isArchivedSeed(entry.seed) || !isPublicSafe(entry.seed)) continue;
    const next = withoutArchivedEntry(entry);
    if (Object.keys(next.topics).length > 0) out[key] = next;
  }
  return out;
}
