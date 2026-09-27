import { LABEL_MAX } from "@/lib/constants";

/**
 * 掛け合わせ: カードを別のカードに重ねて、2つを組み合わせた話題を作る。
 * 掛け合わせたカードの文は「A × B」。AI への指示・キー無しの候補・図鑑の表示は、この形から A と B を取り出して使う。
 */
export const MIX_SEPARATOR = " × ";

/** 片方の語が長すぎると 3×3 の中央に収まらないので、それぞれ短くする */
const MIX_PART_MAX = 20;

function clipPart(label: string): string {
  const trimmed = label.replace(/\s+/g, " ").trim();
  return trimmed.length <= MIX_PART_MAX ? trimmed : `${trimmed.slice(0, MIX_PART_MAX - 1)}…`;
}

/** 重ねた先（土台）× 持ってきたカード */
export function mixLabel(base: string, added: string): string {
  return `${clipPart(base)}${MIX_SEPARATOR}${clipPart(added)}`;
}

/** 「A × B」の形なら [A, B]。「×」の前後に空白の無い語（例「3×3」）は掛け合わせとみなさない */
export function splitMix(label: string): [string, string] | null {
  const index = label.indexOf(MIX_SEPARATOR);
  if (index <= 0) return null;
  const base = label.slice(0, index).trim();
  const added = label.slice(index + MIX_SEPARATOR.length).trim();
  if (!base || !added || added.includes(MIX_SEPARATOR)) return null;
  return [base, added];
}

/** AI への指示（お題が「A × B」のときだけ） */
export function combineInstruction(seed: string): string {
  const parts = splitMix(seed);
  if (!parts) return "";
  const [base, added] = parts;
  return `
このお題は「${base}」と「${added}」の掛け合わせです。どちらか片方だけの話ではなく、両方にまたがる話題（組み合わせたときの意外な共通点・あるある・企画・体験）にしてください。
`;
}

/** キー無し・AI 失敗時の掛け合わせの候補。語を入れると長すぎる形は使わず、「2つ」「組み合わせ」の言い方で埋める */
export function mockMixTopics(seed: string, existing: string[], count: number): string[] | null {
  const parts = splitMix(seed);
  if (!parts) return null;
  const banned = new Set(existing.map((item) => item.trim()));
  const [a, b] = parts.map((part) => part.replace(/…$/, "").trim()) as [string, string];
  const named = [
    `${a}と${b}の共通点`,
    `${a}×${b}のあるある`,
    `${b}目線の${a}`,
    `${a}目線の${b}`,
    `${a}と${b}どっち派`,
    `${a}×${b}の企画`,
  ].filter((item) => item.length <= LABEL_MAX);
  const plain = [
    "2つの意外な共通点",
    "組み合わせのあるある",
    "両方にハマった瞬間",
    "組み合わせた企画",
    "どっち派か聞いてみる",
    "意外なつながり",
    "組み合わせた失敗談",
    "片方しか知らない人へ",
    "2つを語れる思い出",
    "混ぜたら生まれる新ネタ",
  ];
  const picked: string[] = [];
  for (const label of [...named, ...plain]) {
    if (banned.has(label) || picked.includes(label)) continue;
    picked.push(label);
    if (picked.length >= count) break;
  }
  return picked;
}
