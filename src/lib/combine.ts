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
このお題は「${base}」と「${added}」の掛け合わせです。
- どの語も「${base}」と「${added}」の両方に関わる話題にする。片方だけで成り立つ語は出さない
- 組み立て方の例: ${base}の場面で${added}が起きたら / ${added}の目線で見た${base} / 2つの意外な共通点・あるある / 組み合わせた企画・体験・失敗談
- 2つの語をそのまま並べただけの語（「${base}と${added}」）にはしない
例: お題「ゲーム × 料理」なら
よい: ["ゲーム飯の再現","料理ゲームの腕前","徹夜ゲームの夜食","ゲーム内料理の味"]
よくない: ["好きなゲーム","得意料理","ゲームと料理"]
`;
}

/**
 * 掛け合わせた 2 枚が、それぞれ何の話から出てきた語か（AI が語の意味を取り違えないように）。
 * baseFrom は土台のカードの親、addedFrom は持ってきたカードの親の語。
 */
export function mixOriginNote(seed: string, baseFrom?: string, addedFrom?: string): string {
  const parts = splitMix(seed);
  if (!parts) return "";
  const [base, added] = parts;
  const notes = [
    baseFrom && baseFrom !== added ? `「${base}」は「${baseFrom}」の話から` : "",
    addedFrom && addedFrom !== base ? `「${added}」は「${addedFrom}」の話から` : "",
  ].filter(Boolean);
  return notes.length ? `${notes.join("、")}出てきた語です。その意味で組み合わせてください。\n` : "";
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
