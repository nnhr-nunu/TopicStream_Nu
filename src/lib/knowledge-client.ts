import { FILLER_KEY, KNOWLEDGE_KEY } from "@/lib/constants";
import { boardMode } from "@/lib/modes";
import {
  asKnowledgeEntry,
  entriesToStore,
  knowledgeDepth,
  knowledgeKey,
  mergeStores,
  normalizeSeed,
  recordPick,
  recordTopics,
  suggestFromKnowledge,
  type KnowledgeCounts,
  type KnowledgeEntry,
  type KnowledgeStore,
  type PickKind,
} from "@/lib/topic-knowledge";
import { withoutArchived } from "@/lib/topic-archive";
import type { Board, BoardMode } from "@/lib/types";
import { seedKnowledge } from "@/lib/topic-knowledge-seed";

/** 端末に残すお題の数の上限（古いものから消す） */
const LOCAL_LIMIT = 300;
/** みんなの図鑑を待つ上限。これを過ぎたら手元の分だけで進める */
const SHARED_TIMEOUT_MS = 1_500;

export function loadLocalKnowledge(): KnowledgeStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KNOWLEDGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const entries = Object.values(parsed as Record<string, unknown>)
      .map(asKnowledgeEntry)
      .filter((entry): entry is KnowledgeEntry => entry !== null);
    return entriesToStore(entries);
  } catch {
    return {};
  }
}

function writeLocal(store: KnowledgeStore) {
  const keys = Object.keys(store);
  let next = store;
  if (keys.length > LOCAL_LIMIT) {
    const keep = keys.sort((a, b) => store[b]!.updatedAt - store[a]!.updatedAt).slice(0, LOCAL_LIMIT);
    next = Object.fromEntries(keep.map((key) => [key, store[key]!]));
  }
  try {
    window.localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(next));
  } catch {
    /* 容量いっぱい・プライベートモードでは記録しない */
  }
}

/** AI が出した語を自分の図鑑に残す（みんなの図鑑へはサーバーが AI の結果をそのまま記録する） */
export function rememberTopics(seed: string, topics: string[], mode: BoardMode = "chat") {
  if (typeof window === "undefined" || !seed.trim() || topics.length === 0) return;
  writeLocal(recordTopics(loadLocalKnowledge(), seed, topics, Date.now(), 1, mode));
}

/** みんなの図鑑から取ってきたお題（このタブが開いている間だけ覚えておく） */
const sharedCache: KnowledgeStore = {};
const fetchedSeeds = new Set<string>();
/** GitHub Pages のようにサーバーが無いときは、以後問い合わせない */
let sharedUnavailable = false;

async function fetchJson<T>(url: string): Promise<T | null> {
  if (sharedUnavailable) return null;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), SHARED_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.status === 404) {
      sharedUnavailable = true;
      return null;
    }
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function absorbShared(raw: unknown): KnowledgeEntry[] {
  const entries = (Array.isArray(raw) ? raw : [])
    .map(asKnowledgeEntry)
    .filter((entry): entry is KnowledgeEntry => entry !== null);
  for (const entry of entries) sharedCache[knowledgeKey(entry.seed, entry.mode)] = entry;
  return entries;
}

/** そのお題と似たお題を、みんなの図鑑から取ってくる（同じモード・同じお題は1回だけ） */
export async function fetchSharedRelated(seed: string, mode: BoardMode = "chat"): Promise<void> {
  const key = knowledgeKey(seed, mode);
  if (!key || fetchedSeeds.has(key) || typeof window === "undefined") return;
  fetchedSeeds.add(key);
  const json = await fetchJson<{ entries?: unknown }>(
    `/api/knowledge?seed=${encodeURIComponent(seed)}&mode=${encodeURIComponent(mode)}`,
  );
  absorbShared(json?.entries);
}

/** 同梱の初期データ・自分の記録・取ってきたみんなの記録を重ねたもの */
export function combinedKnowledge(): KnowledgeStore {
  return withoutArchived(mergeStores(seedKnowledge(), loadLocalKnowledge(), sharedCache));
}

export type Recall = {
  topics: string[];
  /** そのお題そのものにたまっている語の数（多ければ AI を呼ばずに済ませる判断に使う） */
  depth: number;
};

/** 手元にあるものだけで候補を引く（待たない）。ほかのモードのお題の語は使わない */
export function recallTopicsNow(seed: string, exclude: string[], count: number, mode: BoardMode = "chat"): Recall {
  const store = combinedKnowledge();
  return {
    topics: suggestFromKnowledge(store, seed, exclude, count, Math.random, mode),
    depth: knowledgeDepth(store, seed, mode),
  };
}

/** みんなの図鑑も少しだけ待って候補を引く */
export async function recallTopics(seed: string, exclude: string[], count: number, mode: BoardMode = "chat"): Promise<Recall> {
  await fetchSharedRelated(seed, mode);
  return recallTopicsNow(seed, exclude, count, mode);
}

/** 図鑑ページ用: みんなの図鑑の検索結果を取ってきて手元に重ねる（mode を省くと雑談） */
export async function fetchSharedSearch(
  query: string,
  mode: BoardMode = "chat",
): Promise<{ available: boolean; counts: KnowledgeCounts | null }> {
  if (typeof window === "undefined") return { available: false, counts: null };
  const json = await fetchJson<{ entries?: unknown; counts?: KnowledgeCounts }>(
    `/api/knowledge?q=${encodeURIComponent(query)}&mode=${encodeURIComponent(mode)}`,
  );
  absorbShared(json?.entries);
  const counts = json?.counts && typeof json.counts === "object" ? json.counts : null;
  return { available: !sharedUnavailable && json !== null, counts };
}

/** 送る前の票。数秒ごと（とページを閉じるとき）にまとめて送る */
let pendingPicks: { seed: string; topic: string; kind: PickKind; mode?: BoardMode }[] = [];
let flushTimer: number | null = null;
const FLUSH_MS = 4_000;

function flushPicks(useBeacon = false) {
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pendingPicks.length === 0 || sharedUnavailable) {
    pendingPicks = [];
    return;
  }
  const body = JSON.stringify({ picks: pendingPicks.splice(0, pendingPicks.length) });
  if (useBeacon && navigator.sendBeacon?.("/api/knowledge", new Blob([body], { type: "application/json" }))) return;
  void fetch("/api/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
    .then((response) => {
      if (response.status === 404) sharedUnavailable = true;
    })
    .catch(() => undefined);
}

let listening = false;

/** 埋め合わせの語を覚えておく数（古いものから忘れる） */
const FILLER_LIMIT = 400;

function fillerKey(seed: string, topic: string, mode: BoardMode): string {
  return `${knowledgeKey(seed, mode)}|${normalizeSeed(topic)}`;
}

function loadFillers(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FILLER_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/**
 * AI が使えなかったとき（混雑・枠切れ・キー無し）にオフライン候補で埋めた語を覚えておく。
 * こうした語は定型なので、あとで広げたり ♡ を付けたりしても図鑑には新しく加えない（すでに図鑑にある語なら票は入れる）。
 */
export function markFillers(seed: string, topics: string[], mode: BoardMode = "chat") {
  if (typeof window === "undefined" || !seed.trim() || topics.length === 0) return;
  const keys = topics.map((topic) => fillerKey(seed, topic, mode));
  const next = [...loadFillers().filter((key) => !keys.includes(key)), ...keys].slice(-FILLER_LIMIT);
  try {
    window.localStorage.setItem(FILLER_KEY, JSON.stringify(next));
  } catch {
    /* 覚えられなくても広げるのは続ける */
  }
}

/** 埋め合わせで出た語で、まだ図鑑に無いものか */
function isUnknownFiller(seed: string, topic: string, mode: BoardMode): boolean {
  if (!loadFillers().includes(fillerKey(seed, topic, mode))) return false;
  const entry = combinedKnowledge()[knowledgeKey(seed, mode)];
  return !entry || !Object.keys(entry.topics).some((label) => normalizeSeed(label) === normalizeSeed(topic));
}

/**
 * カードの語が選ばれた（♡・クリックで広げた・ピン・コピー・書き直し・コメントのハート）ことを図鑑に伝える。
 * お題はそのカードの親の語（seedOverride があればそちら）。図鑑に無い語でもそのまま加える（盛り上がった話題を取りこぼさないため）。
 * ただし AI が使えなかったときの埋め合わせの語（markFillers）は加えない。
 */
export function notePick(board: Board, nodeId: string, kind: PickKind, seedOverride?: string) {
  if (typeof window === "undefined") return;
  // お悩み相談などもモードごとに分けて記録する（雑談の図鑑には混ぜない）
  const mode = boardMode(board);
  const node = board.nodes.find((item) => item.id === nodeId);
  const parent = node?.data.parentId ? board.nodes.find((item) => item.id === node.data.parentId) : undefined;
  const topic = node?.data.label.trim();
  const seed = (seedOverride ?? parent?.data.label)?.trim();
  // 最初のお題（親が無い）と、マンダラートの中央（親の写し）は「選ばれた語」ではない
  if (!topic || !seed || node?.data.placeholder || normalizeSeed(topic) === normalizeSeed(seed)) return;
  // 埋め合わせの定型の語は、選ばれても図鑑に新しく加えない（自分で書き直した語は人の語なので入れる）
  if (kind !== "edit" && isUnknownFiller(seed, topic, mode)) return;
  noteTopicPick(seed, topic, kind, mode);
}

/** お題 seed の語 topic が選ばれたことを図鑑に伝える（ボードの外、図鑑を見る画面の ♡ など） */
export function noteTopicPick(seed: string, topic: string, kind: PickKind, mode: BoardMode = "chat") {
  if (typeof window === "undefined") return;
  if (!topic.trim() || !seed.trim() || normalizeSeed(topic) === normalizeSeed(seed)) return;
  writeLocal(recordPick(loadLocalKnowledge(), seed, topic, kind, Date.now(), mode));
  if (sharedUnavailable) return;
  pendingPicks.push({ seed, topic, kind, ...(mode === "chat" ? {} : { mode }) });
  if (!listening) {
    listening = true;
    window.addEventListener("pagehide", () => flushPicks(true));
  }
  if (pendingPicks.length >= 50) flushPicks();
  else flushTimer ??= window.setTimeout(() => flushPicks(), FLUSH_MS);
}
