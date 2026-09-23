const ID_PATTERN = /(?<![A-Za-z0-9])(\d+[A-Ia-i])(?![A-Za-z0-9])/g;
const HEART_PATTERN = /❤|♥|❤️|💕|💖|💗|😍|好き|大好き|推し|あいしてる|love/i;

export type ChatParse = {
  codes: string[];
  highlightCodes: string[];
  heartCodes: string[];
  hasHeart: boolean;
};

export function normalizeCellCode(raw: string): string {
  const match = raw.trim().match(/^(\d+)([A-Ia-i])$/);
  if (!match) return "";
  return `${match[1]}${match[2]!.toUpperCase()}`;
}

export function parseChatComment(text: string, fallbackCode = ""): ChatParse {
  const codes = [...text.matchAll(ID_PATTERN)]
    .map((match) => normalizeCellCode(match[1] ?? ""))
    .filter(Boolean);
  const unique = [...new Set(codes)];
  const hasHeart = HEART_PATTERN.test(text);
  const heartCodes = hasHeart ? (unique.length > 0 ? unique : fallbackCode ? [fallbackCode] : []) : [];
  return {
    codes: unique,
    highlightCodes: unique,
    heartCodes,
    hasHeart,
  };
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
