import { normalizeSeed, type KnowledgeEntry, type KnowledgeStore } from "@/lib/topic-knowledge";

/**
 * トピック図鑑のアーカイブ。話題として微妙な語を、図鑑に出さない・記録し直さないようにする。
 * みんなの図鑑（Redis）からは消さずに隠すだけなので、ここから外せば元に戻る。
 *
 * - BY_SEED: そのお題の下でだけ隠す（お題に合っていない・広がりにくい語）
 * - ANYWHERE: どのお題の下でも隠す（文として壊れている語）
 */
const BY_SEED: Record<string, string[]> = {
  // 広いお題なのに特定の品物ばかり（持っていない人が話に入れない）
  最近買ってよかったもの: [
    "スタンディングデスク",
    "大容量モバイルバッテリー",
    "ロボット掃除機の限界",
    "滑らないハンガー",
    "完全ワイヤレスイヤホン",
    "人間工学チェア",
    "電気圧力鍋の時短効果",
    "昇降式デスクの快適さ",
    "高級トースター",
    "マッサージガン",
    "ネッククーラー",
    "珪藻土バスマット",
    "首肩マッサージ機",
    "香り重視の柔軟剤",
    "完全遮光のカーテン",
    "ロボット掃除機",
    "多機能ペン",
    "ワイヤレスイヤホンのノイキャン",
    "自動ゴミ箱の便利さ",
    "痛くならないルームシューズ",
    "電気圧力鍋",
    "スマートウォッチ",
  ],
  // お題とずれている
  朝ごはん何食べた: ["深夜のドカ食い", "健康診断前の焦り"],
  "もしも一日だけ入れ替わるなら": ["深夜のコンビニ", "親の財布事情", "超高級タワマン"],
  "人見知りする？しない？": ["アイコン設定", "デリバリーの活用"],
  今月の小さな目標: ["深夜の誘惑", "エナジードリンク", "モチベーション"],
  最近の天気の話: ["デリバリーの注文"],
  // 短すぎて話の取っかかりにならない
  理想の休日デート: ["ハプニング"],
  課金しすぎた: ["冷や汗"],
  衝動買いしたもの: ["衝動の全貌"],
  人が来なくて: ["モチベーション"],
};

const ANYWHERE = [
  "高級な高級ヘッドホン",
  "買い食いした買い食い",
  "ポスターの額縁ポスターフレーム",
  "扇風機の前で声帯を震わせる",
  "演出の昇昇昇格",
  "記憶喪失の歌詞",
  "宗教上の理由の課金",
];

const bySeed = new Map(
  Object.entries(BY_SEED).map(([seed, topics]) => [normalizeSeed(seed), new Set(topics.map(normalizeSeed))]),
);
const anywhere = new Set(ANYWHERE.map(normalizeSeed));

export function isArchived(seed: string, topic: string): boolean {
  const label = normalizeSeed(topic);
  return anywhere.has(label) || Boolean(bySeed.get(normalizeSeed(seed))?.has(label));
}

function withoutArchivedEntry(entry: KnowledgeEntry): KnowledgeEntry {
  const keep = (label: string) => !isArchived(entry.seed, label);
  const topics = Object.fromEntries(Object.entries(entry.topics).filter(([label]) => keep(label)));
  const next: KnowledgeEntry = { ...entry, topics };
  delete next.picks;
  const picks = Object.fromEntries(Object.entries(entry.picks ?? {}).filter(([label]) => keep(label)));
  if (Object.keys(picks).length > 0) next.picks = picks;
  return next;
}

/** アーカイブした語を除いた図鑑（語が1つも残らないお題は出さない） */
export function withoutArchived(store: KnowledgeStore): KnowledgeStore {
  const out: KnowledgeStore = {};
  for (const [key, entry] of Object.entries(store)) {
    const next = withoutArchivedEntry(entry);
    if (Object.keys(next.topics).length > 0) out[key] = next;
  }
  return out;
}
