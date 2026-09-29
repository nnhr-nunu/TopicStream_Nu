import { asStringList, createLiveBus } from "@/lib/live-bus";

export type ChatHeartSpark = {
  codes: string[];
  count: number;
};

const bus = createLiveBus<ChatHeartSpark>("topicstream-nu-hearts", (data) => {
  const spark = data as Partial<ChatHeartSpark> | null;
  const codes = asStringList(spark?.codes);
  const count = Number(spark?.count);
  return codes && Number.isFinite(count) && count >= 1 ? { codes, count: Math.min(999, Math.round(count)) } : null;
});

/** 配信者のハート（クリック）とコメントで届いたハートを1つの数にまとめる。 */
export function totalHearts(data: { heartCount?: number; frameHearts?: number }): number {
  return Math.max(0, (data.heartCount ?? 0) + (data.frameHearts ?? 0));
}

/** バッジ用の短い表記（1234 → 1.2k）。 */
export function formatHeartCount(total: number): string {
  if (total < 1000) return String(Math.max(0, Math.round(total)));
  const k = total / 1000;
  return `${k >= 10 ? Math.floor(k) : Math.floor(k * 10) / 10}k`;
}

export function emitChatHearts(codes: string[], count = 1) {
  if (codes.length === 0 || count < 1) return;
  bus.emit({ codes, count: Math.round(count) });
}

export function subscribeChatHearts(onSpark: (spark: ChatHeartSpark) => void): () => void {
  return bus.subscribe(onSpark);
}
