import { splitMix } from "@/lib/combine";
import { splitGloss } from "@/lib/node-box";
import { similarity } from "@/lib/topic-knowledge";

/**
 * 語（カードの文字）とお題の品質を守る、小さな判定。AI の返答を取り込むとき（gemini-core）と、
 * 図鑑に記録するとき（knowledge-server / api/gemini）の両方で使う。
 *
 * 公開前に本番の図鑑を棚卸しして見つかった問題への対策:
 * - 長い語を「…」で切って取り込んだ結果が、そのまま図鑑の語・次のお題になっていた
 * - 「理不尽な〜」「誰もいない〜」のように、同じ書き出しの語が1回の候補に何個も並んでいた
 * - 「語：意味」「A × B」や、遠い文脈の中で出た切り口が、単独のお題として記録されていた
 */

/** 途中で切れた語（末尾が「…」）。カードの文字としても図鑑の語・お題としても使えない */
export function isTruncatedLabel(label: string): boolean {
  return /(?:…|\.{3})\s*$/u.test(label.trim());
}

/** 同じ書き出しとみなす文字数 */
const STEM_LENGTH = 4;
/** 1回の候補に、同じ書き出しの語を並べてよい数 */
export const PER_STEM_MAX = 2;

function stemOf(label: string): string | null {
  const chars = [...label.trim()];
  return chars.length > STEM_LENGTH ? chars.slice(0, STEM_LENGTH).join("") : null;
}

function compact(label: string): string {
  return label.normalize("NFKC").replace(/[\s、。・,.!?！？「」『』（）()]/gu, "");
}

/** ほぼ同じ語か。片方がもう片方に含まれる（4文字以上）か、2文字ずつの重なりがほとんど同じ */
export function isNearDuplicate(a: string, b: string): boolean {
  const x = compact(a);
  const y = compact(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length >= 4 && long.includes(short)) return true;
  return similarity(x, y) >= 0.8;
}

/**
 * 1回の候補から、切れた語・ほぼ同じ語・同じ書き出しの続く語（3個目から）を落とす。順番は保つ。
 * 「〇〇な〜」を8個並べる、のような単調な返答を、ほかの切り口で埋め直せるようにするため。
 */
export function diversifyLabels(labels: string[], perStem = PER_STEM_MAX): string[] {
  const kept: string[] = [];
  const stems = new Map<string, number>();
  for (const label of labels) {
    if (isTruncatedLabel(label)) continue;
    if (kept.some((other) => isNearDuplicate(label, other))) continue;
    const stem = stemOf(label);
    if (stem) {
      const used = stems.get(stem) ?? 0;
      if (used >= perStem) continue;
      stems.set(stem, used + 1);
    }
    kept.push(label);
  }
  return kept;
}

/**
 * このお題を、単独のお題として図鑑に記録してよいか。
 * 記録しないもの:
 * - 途中で切れたもの・「A × B」の掛け合わせ・「語：意味」の形（広げても、そのお題の一般的な切り口にならない）
 * - 2つ以上離れた文脈の中で出たもの（元のお題しだいの切り口になり、同じ名前のお題の語に混ざってしまう）
 * - 1つ離れた文脈で、3文字以下の短いもの（「雪」「秋」「猫」のように、文脈しだいで意味が変わる）
 * context は広げるカードの祖先（近い順）。中心のお題を直接広げたときは空。
 */
export function isRecordableSeed(seed: string, context: string[] = []): boolean {
  const text = seed.trim();
  if (!text || isTruncatedLabel(text) || splitMix(text) || splitGloss(text)) return false;
  if (context.length >= 2) return false;
  if (context.length === 1 && [...text].length <= 3) return false;
  return true;
}
