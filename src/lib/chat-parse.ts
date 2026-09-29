const ID_PATTERN = /(?<![A-Za-z0-9])(\d{1,3})([A-Ia-i])(?![A-Za-z0-9])/g;
/**
 * 小文字のコードは「3h待った」「2d前」のような時間・単位と紛れるので、
 * コメントの終わりか、区切り・助詞・ハートが続くときだけ数える（大文字はどこでも数える）
 */
const LOWER_CODE_FOLLOW = /^(?:$|[\s、。，．,.!?！？♥❤💕💖💗😍がをはのにへもってとで])/u;
const HEART_PATTERN = /❤|♥|💕|💖|💗|😍|好き|大好き|推し|あいしてる|\blove\b/i;

/** URL や @ハンドルの中の「3d」「1e」をコードと取り違えないよう、先に外す。「1Eｗｗ」「1E2F」は読めるように区切る */
function cleanForCodes(text: string): string {
  return text
    .replace(/https?:\/\/\S+|www\.\S+|@[\w.-]+/g, " ")
    .replace(/(\d[A-Ia-i])[wW]+(?![A-Za-z0-9])/g, "$1 ")
    .replace(/(\d[A-I])(?=\d{1,3}[A-I](?![A-Za-z0-9]))/g, "$1 ");
}

export type ChatParse = {
  codes: string[];
  highlightCodes: string[];
  heartCodes: string[];
  hasHeart: boolean;
};

/** 全角英数（１Ｅ・１ｅ）や全角スペースを半角にそろえる。 */
export function toHalfWidth(text: string): string {
  return text.normalize("NFKC");
}

export function normalizeCellCode(raw: string): string {
  const match = toHalfWidth(raw).trim().match(/^(\d+)([A-Ia-i])$/);
  if (!match) return "";
  return `${match[1]}${match[2]!.toUpperCase()}`;
}

export function parseChatComment(text: string, fallbackCode = ""): ChatParse {
  const normalized = toHalfWidth(text);
  const cleaned = cleanForCodes(normalized);
  const codes = [...cleaned.matchAll(ID_PATTERN)]
    .filter((match) => {
      const letter = match[2] ?? "";
      if (letter === letter.toUpperCase()) return true;
      return LOWER_CODE_FOLLOW.test(cleaned.slice((match.index ?? 0) + match[0].length));
    })
    .map((match) => normalizeCellCode(`${match[1] ?? ""}${match[2] ?? ""}`))
    .filter(Boolean);
  const unique = [...new Set(codes)];
  const hasHeart = HEART_PATTERN.test(text) || HEART_PATTERN.test(normalized);
  const heartCodes = hasHeart ? (unique.length > 0 ? unique : fallbackCode ? [fallbackCode] : []) : [];
  return {
    codes: unique,
    highlightCodes: unique,
    heartCodes,
    hasHeart,
  };
}

/** コメント1件で +1 するカード。IDがあればそのID、無ければ ❤ だけのときピン留め中のカード。 */
export function commentHeartCodes(parsed: ChatParse): string[] {
  return parsed.codes.length > 0 ? parsed.codes : parsed.heartCodes;
}

export function findNodeByCode<T extends { data: { groupId?: number; cellIndex?: number } }>(
  nodes: T[],
  code: string,
): T | undefined {
  const wanted = normalizeCellCode(code);
  if (!wanted) return undefined;
  return nodes.find((node) => {
    const groupId = node.data.groupId;
    const cellIndex = node.data.cellIndex;
    if (typeof groupId !== "number" || typeof cellIndex !== "number") return false;
    const letter = "ABCDEFGHI"[cellIndex];
    return `${groupId}${letter}` === wanted;
  });
}
