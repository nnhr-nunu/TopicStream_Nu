import { MEMO_MAX } from "@/lib/constants";
import { splitGloss } from "@/lib/node-box";
import type { BoardMode } from "@/lib/types";

/**
 * 「これって何？」: カードの言葉を、話の流れ（祖先のお題）を踏まえて短く解説する。
 * 盤面は広げず、読んで分かれば済むもの。付箋に貼れるよう MEMO_MAX に収める。
 */

/** 解説の長さの上限（付箋にそのまま貼れる長さ） */
export const EXPLAIN_MAX = MEMO_MAX;

export type Explanation = {
  /** 解説の文。キーが無く、手元でも言えることが無いときは空 */
  text: string;
  source: "gemini" | "offline";
  /** 自分で調べるときの検索語 */
  query: string;
};

const MODE_HINT: Partial<Record<BoardMode, string>> = {
  advice: "悩み相談の中の言葉なので、責めずにやさしく説明する。",
  learn: "学ぶための言葉なので、定義を正確に説明する。",
};

/** 「ぶち：すごく」のようなカードは語の部分だけを見る */
function termOf(label: string): string {
  return splitGloss(label)?.term ?? label.trim();
}

export function explainQuery(label: string, context: string[] = []): string {
  const term = termOf(label);
  const near = context[0];
  return near && !term.includes(near) ? `${near} ${term}` : term;
}

export function buildExplainPrompt(label: string, context: string[] = [], mode: BoardMode = "chat"): string {
  const term = termOf(label);
  const path = [...context].reverse();
  const lines = [
    "あなたは配信者のそばにいる物知りな相棒です。配信者が画面のカードの言葉を見て「これって何？」と聞いています。",
    `カードの言葉: ${term}`,
    path.length ? `話の流れ（大きいお題から順に）: ${path.join(" › ")} › ${term}` : "",
    "この流れの中での意味を、配信でそのまま話せるように説明してください。",
    "ルール:",
    "- 日本語で 2〜3 文、全体で 60〜100 字。",
    "- 1 文目で「何か」を言い切る。2 文目以降は使い方・例・豆知識のどれか 1 つ。",
    "- 方言・用語・略語なら意味と使い方の例を入れる（例: 「ぶち」は広島弁で「とても」。「ぶちうまい」のように使う）。",
    "- 確かでないことは書かない。はっきりしないなら「地域や人によって意味が違う」のように正直に書く。",
    "- 見出し・箇条書き・記号の装飾・前置きは付けない。解説の文だけを返す。",
    MODE_HINT[mode] ?? "",
  ];
  return lines.filter(Boolean).join("\n");
}

/** AI の返事から、解説の文だけを取り出して長さをそろえる */
export function parseExplanation(raw: string): string {
  const text = raw
    .replace(/```[a-z]*\n?|```/gi, "")
    .replace(/^\s*(?:[-*・#>]+|\d+[.)])\s*/gm, "")
    .replace(/\*\*|__/g, "")
    .replace(/^\s*(?:解説|答え|回答)\s*[:：]\s*/, "")
    .replace(/\s*\n\s*/g, "")
    .trim()
    // 全体を囲むかぎかっこだけ外す（「ぶち」は… の「」は残す）
    .replace(/^"([^"]*)"$|^「([^「」]*)」$/u, "$1$2");
  return clipSentence(text, EXPLAIN_MAX);
}

/** 上限を超えたら、上限までの最後の「。」で切る（無ければ「…」を付けて切る） */
export function clipSentence(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const end = head.lastIndexOf("。");
  return end >= max / 3 ? head.slice(0, end + 1) : `${head.slice(0, max - 1)}…`;
}

/** キーが無いとき: 「言葉：意味」のカードなら意味をそのまま言い、それ以外は調べる導線だけ出す */
export function offlineExplanation(label: string, context: string[] = []): Explanation {
  const gloss = splitGloss(label);
  const near = context[0];
  const text = gloss
    ? clipSentence(`「${gloss.term}」は${near ? `${near}で` : ""}「${gloss.meaning}」という意味。`, EXPLAIN_MAX)
    : "";
  return { text, source: "offline", query: explainQuery(label, context) };
}

/** 付箋に足す（今の付箋があれば改行して後ろへ。入りきらなければ解説を縮める） */
export function appendToMemo(memo: string, text: string): string {
  const current = memo.trim();
  if (!current) return clipSentence(text, EXPLAIN_MAX);
  if (current.includes(text)) return current;
  const room = EXPLAIN_MAX - current.length - 1;
  if (room < 10) return current;
  return `${current}\n${clipSentence(text, room)}`;
}
