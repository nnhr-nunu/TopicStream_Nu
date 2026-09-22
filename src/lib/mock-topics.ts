import { CHILD_COUNT, LABEL_MAX } from "@/lib/constants";
import { STARTER_TOPICS } from "@/lib/starters";

const THEME_MAP: Record<string, string[]> = {
  最近買ってよかったもの: [
    "失敗した買い物",
    "リピート確定",
    "推しグッズ",
    "生活が楽になった",
    "高いけど満足",
    "100均の神",
    "配信機材",
    "食べ物のお取り寄せ",
  ],
  ヒヤッとした体験: [
    "電車でありがちな",
    "深夜の帰り道",
    "配信事故",
    "パスワード忘れ",
    "ギリギリセーフ",
    "今だから笑える",
    "リスナーのヒヤリ",
    "二度としないこと",
  ],
  昔ハマってたゲーム: [
    "課金しすぎた",
    "クリアできなかった",
    "神曲BGM",
    "友達と徹夜",
    "今はもう無理",
    "リメイクしてほしい",
    "キャラ愛が深い",
    "初めてRTAした",
  ],
  今週の推し活: [
    "ライブの余韻",
    "グッズ開封",
    "沼の深さ",
    "課金事情",
    "布教ポイント",
    "推し変しそう",
    "遠征あるある",
    "リスナーの推し",
  ],
  料理で失敗した話: [
    "塩を入れすぎた",
    "焦げた夜",
    "レシピ無視",
    "意外と成功",
    "コンビニで挽回",
    "得意料理はこれ",
    "食べられない闇",
    "聞きたい失敗談",
  ],
  今欲しいガジェット: [
    "マイク周り",
    "照明の悩み",
    "キーボード沼",
    "スマホ乗り換え",
    "高い理由",
    "中古でもいい",
    "配線が嫌い",
    "これで配信が変わる",
  ],
  雨の日の過ごし方: [
    "鍋が食べたい",
    "窓際でダラダラ",
    "雨音ASMR",
    "洗濯が乾かない",
    "好きな雨曲",
    "外出する派",
    "配信向きの天気",
    "雨の匂い",
  ],
  初配信の思い出: [
    "声が震えた",
    "人が来なくて",
    "タイトルミス",
    "機材トラブル",
    "今見ると恥ずかしい",
    "最初のコメント",
    "続けられた理由",
    "あの頃の自分へ",
  ],
};

const GENERIC_SUFFIXES = [
  "の失敗",
  "あるある",
  "の沼",
  "の思い出",
  "をやめた理由",
  "の正解",
  "の新常識",
];

const GENERIC_PREFIXES = [
  "初めての",
  "今の",
  "昔の",
  "意外な",
  "深夜の",
  "リスナーの",
];

const SPICE = [
  "高い vs 安い",
  "好き嫌いが割れる",
  "今だから言える",
  "まだ誰にも話してない",
  "三択で聞きたい",
  "答えにくい質問",
  "今年のベスト",
  "やらなきゃよかった",
  "リピート確定",
  "一回で飽きた",
  "布教してもいい？",
  "秘密のルーティン",
];

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

function clipLabel(label: string): string {
  const trimmed = label.replace(/\s+/g, " ").trim();
  if (trimmed.length <= LABEL_MAX) return trimmed;
  return `${trimmed.slice(0, LABEL_MAX - 1)}…`;
}

function uniquePush(target: string[], value: string, banned: Set<string>) {
  const label = clipLabel(value);
  if (!label || banned.has(label) || target.includes(label)) return;
  target.push(label);
}

export function mockRelatedTopics(
  seed: string,
  existing: string[] = [],
  count = CHILD_COUNT,
  preferred: string[] = [],
): string[] {
  const banned = new Set(existing.map((item) => item.trim()).filter(Boolean));
  banned.add(seed.trim());

  const random = mulberry32(hashString(`${seed}:${existing.join("|")}:${Date.now() % 97}`));
  const picked: string[] = [];

  for (const item of preferred) {
    uniquePush(picked, item, banned);
  }

  const mapped = THEME_MAP[seed] ?? THEME_MAP[Object.keys(THEME_MAP).find((key) => seed.includes(key)) ?? ""];
  if (mapped) {
    for (const item of shuffle(mapped, random)) {
      uniquePush(picked, item, banned);
    }
  }

  for (const prefix of shuffle(GENERIC_PREFIXES, random)) {
    uniquePush(picked, `${prefix}${seed}`, banned);
  }
  for (const suffix of shuffle(GENERIC_SUFFIXES, random)) {
    uniquePush(picked, `${seed}${suffix}`, banned);
  }
  for (const spice of shuffle(SPICE, random)) {
    uniquePush(picked, spice, banned);
  }

  const unusedStarters = shuffle(
    STARTER_TOPICS.filter((topic) => topic !== seed),
    random,
  );
  for (const starter of unusedStarters) {
    uniquePush(picked, starter, banned);
  }

  return picked.slice(0, count);
}
