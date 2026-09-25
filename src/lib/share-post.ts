import type { Board } from "@/lib/types";

// 推しログの #推しログぬ・エゴサ支援ツールの #エゴサ支援ツールぬ と同じ「サービス名＋ぬ」。
// 括弧入りの (ぬ) はハッシュタグが途中で切れるので使わない
export const SHARE_HASHTAG = "#TopicStreamぬ";

// X の投稿上限。URL は長さに関係なく 23 文字として数える（t.co 短縮）
export const POST_LIMIT = 280;
const URL_WEIGHT = 23;

/** 中心のテーマと、そこから広げた最初の話題 */
export function boardTopics(board: Board): { theme: string; topics: string[] } {
  const root = board.nodes.find((node) => node.data.parentId === null && !node.data.placeholder);
  const theme = (root?.data.label ?? board.name).trim();
  const topics = root
    ? board.nodes
        .filter((node) => node.data.parentId === root.id && !node.data.placeholder)
        .map((node) => node.data.label.trim())
        .filter(Boolean)
    : [];
  return { theme, topics };
}

/** 「文例を入れる」で流し込むたたき台。本文は空欄から自由に書くのが既定 */
export function buildShareExample(board: Board): string {
  const { theme, topics } = boardTopics(board);
  if (!theme) return "配信の雑談ネタをマインドマップで広げてみました💬";
  const head = `「${theme}」から雑談ネタを広げてみました💬`;
  if (topics.length === 0) return head;
  const shown = topics.slice(0, 4).join("・");
  return `${head}\n${shown}${topics.length > 4 ? " ほか" : ""}`;
}

/** 投稿する本文。ハッシュタグは消せないようにして、拡散の足跡を残す */
export function composeSharePost(body: string): string {
  const trimmed = body.trim();
  return trimmed ? `${trimmed}\n\n${SHARE_HASHTAG}` : SHARE_HASHTAG;
}

export function tweetIntentUrl(text: string, url: string): string {
  const params = new URLSearchParams();
  if (text.trim()) params.set("text", text.trim());
  if (url.trim()) params.set("url", url.trim());
  return `https://x.com/intent/tweet?${params.toString()}`;
}

// X の文字数カウント（twitter-text の重み付け）。ラテン・一般記号は 1、日本語や絵文字は 2
function charWeight(codePoint: number): number {
  if (codePoint <= 0x10ff) return 1;
  if (codePoint >= 0x2000 && codePoint <= 0x200d) return 1;
  if (codePoint >= 0x2010 && codePoint <= 0x201f) return 1;
  if (codePoint >= 0x2032 && codePoint <= 0x2037) return 1;
  return 2;
}

/** 本文＋添付 URL の重み付き文字数（intent は本文の後ろに空白 1 つで URL を足す） */
export function weightedPostLength(text: string, withUrl: boolean): number {
  let total = 0;
  for (const char of text.normalize("NFC")) total += charWeight(char.codePointAt(0) ?? 0);
  if (withUrl) total += (text ? 1 : 0) + URL_WEIGHT;
  return total;
}
