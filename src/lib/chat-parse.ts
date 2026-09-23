const ID_PATTERN = /(?<![A-Za-z0-9])(\d+[A-Ia-i])(?![A-Za-z0-9])/g;
const HEART_PATTERN = /❤|♥|❤️|💕|💖|💗|😍|好き|大好き|推し|あいしてる|love/i;

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
  const codes = [...normalized.matchAll(ID_PATTERN)]
    .map((match) => normalizeCellCode(match[1] ?? ""))
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
