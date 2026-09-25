/**
 * トピック図鑑（集合知）の中身と、そこから候補を引く計算。ブラウザでもサーバーでも使う純粋な関数だけ置く。
 *
 * 「お題 → そこから広がった語（と出た回数）」をためておき、
 * 同じお題・似たお題が来たら AI を呼ばずにここから出す。保存先は
 * 同梱の初期データ（topic-knowledge-seed）・自分の端末（knowledge-local）・みんなの共有（knowledge-server）の3つ。
 */

export type CategoryId =
  | "game"
  | "food"
  | "oshi"
  | "stream"
  | "music"
  | "media"
  | "life"
  | "shopping"
  | "memory"
  | "hobby"
  | "talk"
  | "other";

export type KnowledgeEntry = {
  /** 表示用のお題（最初に記録されたときの書き方） */
  seed: string;
  category: CategoryId;
  /** そこから広がった語 → 出た回数 */
  topics: Record<string, number>;
  /** そのお題が広げられた回数 */
  uses: number;
  updatedAt: number;
};

/** キーは normalizeSeed したお題 */
export type KnowledgeStore = Record<string, KnowledgeEntry>;

export const CATEGORIES: { id: CategoryId; label: string; words: string[] }[] = [
  { id: "game", label: "ゲーム", words: ["ゲーム", "RTA", "ガチャ", "ソシャゲ", "攻略", "ボス", "レベル", "プレイ", "対戦", "実況"] },
  { id: "food", label: "食べもの", words: ["料理", "ご飯", "ごはん", "食べ", "飲み", "レシピ", "鍋", "コンビニ", "スイーツ", "お菓子", "ラーメン", "カフェ", "味", "夜食", "グルメ", "お取り寄せ", "焦げ"] },
  { id: "oshi", label: "推し活", words: ["推し", "沼", "ライブ", "グッズ", "アイドル", "ファン", "布教", "遠征", "現場"] },
  { id: "stream", label: "配信", words: ["配信", "リスナー", "コメント", "機材", "マイク", "視聴者", "コラボ", "VTuber", "企画", "照明", "OBS"] },
  { id: "music", label: "音楽・声", words: ["曲", "歌", "音楽", "カラオケ", "BGM", "バンド", "声", "音", "サビ", "ASMR"] },
  { id: "media", label: "アニメ・作品", words: ["アニメ", "漫画", "マンガ", "映画", "ドラマ", "小説", "本", "作品", "キャラ", "声優"] },
  { id: "life", label: "暮らし・季節", words: ["朝", "夜", "睡眠", "眠", "掃除", "洗濯", "生活", "ルーティン", "休日", "天気", "雨", "季節", "夏", "冬", "春", "秋", "部屋"] },
  { id: "shopping", label: "買い物・お金", words: ["買", "ガジェット", "100均", "節約", "お金", "値段", "高い", "安い", "欲しい", "課金", "セール"] },
  { id: "memory", label: "思い出・地元", words: ["思い出", "昔", "学生", "部活", "子ども", "子供", "初", "地元", "出身", "卒業", "懐かし", "なつかし", "方言", "イントネーション"] },
  { id: "hobby", label: "趣味", words: ["趣味", "マイブーム", "コレクション", "旅行", "スポーツ", "運動", "ペット", "ぬいぐるみ", "散歩", "キャンプ"] },
  { id: "talk", label: "あるある・もしも", words: ["もし", "あるある", "ルール", "失敗", "ヒヤ", "恥ずかし", "悩み", "本音", "質問", "秘密", "ゆずれない", "事故"] },
  { id: "other", label: "その他", words: [] },
];

export function categoryLabel(id: CategoryId): string {
  return CATEGORIES.find((item) => item.id === id)?.label ?? "その他";
}

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && CATEGORIES.some((item) => item.id === value);
}

/** 表記ゆれ（全角半角・大文字小文字・空白・末尾の「？」など）をそろえて、同じお題を1つにまとめる */
export function normalizeSeed(seed: string): string {
  return seed
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[?!。、.,…]+$/u, "")
    .trim();
}

/** お題とそこから出た語の言葉から、いちばん近い分類を選ぶ（お題の言葉は2倍に数える） */
export function classifyTopic(seed: string, topics: string[] = []): CategoryId {
  const seedText = seed.normalize("NFKC");
  const topicText = topics.join(" ").normalize("NFKC");
  let best: CategoryId = "other";
  let bestScore = 0;
  for (const category of CATEGORIES) {
    let score = 0;
    for (const word of category.words) {
      if (seedText.includes(word)) score += 2;
      if (topicText.includes(word)) score += 1;
    }
    if (score > bestScore) {
      best = category.id;
      bestScore = score;
    }
  }
  return best;
}

function bigrams(text: string): Set<string> {
  const plain = normalizeSeed(text).replace(/[\s、。・,.!?！？「」『』（）()]/gu, "");
  const chars = [...plain];
  if (chars.length < 2) return new Set(chars);
  const out = new Set<string>();
  for (let i = 0; i < chars.length - 1; i += 1) out.add(chars[i]! + chars[i + 1]!);
  return out;
}

/** 2文字ずつの重なり（Dice 係数）。日本語でも形態素解析なしでそこそこ効く。0〜1 */
export function similarity(a: string, b: string): number {
  const x = bigrams(a);
  const y = bigrams(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const gram of x) if (y.has(gram)) shared += 1;
  return (2 * shared) / (x.size + y.size);
}

/** 1つのお題に持たせる語の上限（少ない回数のものから落とす） */
export const TOPICS_PER_SEED = 40;

function trimTopics(topics: Record<string, number>, limit = TOPICS_PER_SEED): Record<string, number> {
  const entries = Object.entries(topics);
  if (entries.length <= limit) return topics;
  return Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, limit));
}

/** お題と、そこから出た語を1回分記録する（元の store は変えない） */
export function recordTopics(
  store: KnowledgeStore,
  seed: string,
  topics: string[],
  now = Date.now(),
  weight = 1,
): KnowledgeStore {
  const key = normalizeSeed(seed);
  const cleaned = [...new Set(topics.map((item) => item.trim()).filter((item) => item && normalizeSeed(item) !== key))];
  if (!key || cleaned.length === 0) return store;
  const current = store[key];
  const merged = { ...(current?.topics ?? {}) };
  for (const label of cleaned) merged[label] = (merged[label] ?? 0) + weight;
  const allTopics = Object.keys(merged);
  return {
    ...store,
    [key]: {
      seed: current?.seed ?? seed.trim(),
      category: classifyTopic(current?.seed ?? seed, allTopics),
      topics: trimTopics(merged),
      uses: (current?.uses ?? 0) + 1,
      updatedAt: now,
    },
  };
}

/** 複数の保存先を1つに重ねる（回数は足し合わせる） */
export function mergeStores(...stores: KnowledgeStore[]): KnowledgeStore {
  const out: KnowledgeStore = {};
  for (const store of stores) {
    for (const [key, entry] of Object.entries(store)) {
      const current = out[key];
      if (!current) {
        out[key] = { ...entry, topics: { ...entry.topics } };
        continue;
      }
      const topics = { ...current.topics };
      for (const [label, count] of Object.entries(entry.topics)) topics[label] = (topics[label] ?? 0) + count;
      out[key] = {
        seed: current.seed,
        category: current.category === "other" ? entry.category : current.category,
        topics: trimTopics(topics),
        uses: current.uses + entry.uses,
        updatedAt: Math.max(current.updatedAt, entry.updatedAt),
      };
    }
  }
  return out;
}

export function entriesToStore(entries: KnowledgeEntry[]): KnowledgeStore {
  const out: KnowledgeStore = {};
  for (const entry of entries) {
    const key = normalizeSeed(entry.seed);
    if (key) out[key] = out[key] ? mergeStores({ [key]: out[key]! }, { [key]: entry })[key]! : entry;
  }
  return out;
}

/** 外から来たデータ（localStorage・API）を型どおりにそろえる。壊れた行は捨てる */
export function asKnowledgeEntry(value: unknown): KnowledgeEntry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<KnowledgeEntry>;
  if (typeof raw.seed !== "string" || !raw.seed.trim() || !raw.topics || typeof raw.topics !== "object") return null;
  const topics: Record<string, number> = {};
  for (const [label, count] of Object.entries(raw.topics)) {
    if (label.trim() && typeof count === "number" && Number.isFinite(count) && count > 0) topics[label] = count;
  }
  if (Object.keys(topics).length === 0) return null;
  return {
    seed: raw.seed.trim(),
    category: isCategoryId(raw.category) ? raw.category : classifyTopic(raw.seed, Object.keys(topics)),
    topics: trimTopics(topics),
    uses: typeof raw.uses === "number" && raw.uses > 0 ? raw.uses : 1,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
  };
}

/** これ以上似ていれば「似たお題」として語を借りる */
export const SIMILAR_THRESHOLD = 0.34;

export type RelatedEntry = { entry: KnowledgeEntry; score: number; exact: boolean };

/** お題そのもの（exact）と、似たお題を近い順に返す */
export function relatedEntries(store: KnowledgeStore, seed: string, limit = 6): RelatedEntry[] {
  const key = normalizeSeed(seed);
  const exact = store[key];
  const category = exact?.category ?? classifyTopic(seed);
  const similar: RelatedEntry[] = [];
  for (const [entryKey, entry] of Object.entries(store)) {
    if (entryKey === key) continue;
    const base = similarity(seed, entry.seed);
    // 同じ分類なら少しだけ近いとみなす（「その他」どうしは除く）
    const score = base + (category !== "other" && entry.category === category ? 0.12 : 0);
    if (score >= SIMILAR_THRESHOLD) similar.push({ entry, score: Math.min(score, 0.95), exact: false });
  }
  similar.sort((a, b) => b.score - a.score);
  return [...(exact ? [{ entry: exact, score: 1, exact: true }] : []), ...similar.slice(0, limit)];
}

/** そのお題そのものについて、いくつの語がたまっているか */
export function knowledgeDepth(store: KnowledgeStore, seed: string): number {
  return Object.keys(store[normalizeSeed(seed)]?.topics ?? {}).length;
}

/**
 * 図鑑から候補を引く。お題そのものの語を重く、似たお題の語は似ている度合いで軽くして、
 * 重み付きでくじ引きする（毎回同じ並びにならないように）。盤面にある語とお題そのものは出さない。
 */
export function suggestFromKnowledge(
  store: KnowledgeStore,
  seed: string,
  exclude: string[],
  count: number,
  random: () => number = Math.random,
): string[] {
  const banned = new Set([...exclude.map((item) => item.trim()), seed.trim()]);
  const weights = new Map<string, number>();
  for (const { entry, score, exact } of relatedEntries(store, seed)) {
    for (const [label, times] of Object.entries(entry.topics)) {
      if (banned.has(label)) continue;
      const weight = (exact ? 3 : score) * Math.sqrt(times);
      weights.set(label, (weights.get(label) ?? 0) + weight);
    }
  }
  const pool = [...weights.entries()];
  const picked: string[] = [];
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((sum, [, weight]) => sum + weight, 0);
    let cursor = random() * total;
    let index = pool.findIndex(([, weight]) => (cursor -= weight) <= 0);
    if (index < 0) index = pool.length - 1;
    picked.push(pool[index]![0]);
    pool.splice(index, 1);
  }
  return picked;
}

export type KnowledgeSearchHit = {
  entry: KnowledgeEntry;
  /** 並べ替え用 */
  score: number;
  /** 検索語に当たった語（お題以外で当たったとき） */
  matchedTopics: string[];
};

/** 図鑑ページの検索。お題・語の部分一致と、お題の似かたで探す。空なら人気順 */
export function searchKnowledge(
  store: KnowledgeStore,
  query: string,
  category: CategoryId | "all" = "all",
  limit = 60,
): KnowledgeSearchHit[] {
  const q = normalizeSeed(query);
  const hits: KnowledgeSearchHit[] = [];
  for (const entry of Object.values(store)) {
    if (category !== "all" && entry.category !== category) continue;
    const popularity = Math.log2(1 + entry.uses + Object.values(entry.topics).reduce((sum, value) => sum + value, 0) / 4);
    if (!q) {
      hits.push({ entry, score: popularity, matchedTopics: [] });
      continue;
    }
    const seedHit = normalizeSeed(entry.seed).includes(q);
    const matchedTopics = Object.keys(entry.topics).filter((label) => normalizeSeed(label).includes(q));
    const near = similarity(query, entry.seed);
    if (!seedHit && matchedTopics.length === 0 && near < SIMILAR_THRESHOLD) continue;
    const score = (seedHit ? 10 : 0) + matchedTopics.length * 2 + near * 5 + popularity * 0.3;
    hits.push({ entry, score, matchedTopics });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** 回数の多い順の語 */
export function rankedTopics(entry: KnowledgeEntry, limit = TOPICS_PER_SEED): string[] {
  return Object.entries(entry.topics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label]) => label);
}
