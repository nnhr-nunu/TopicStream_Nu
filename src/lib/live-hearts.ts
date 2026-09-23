export type ChatHeartSpark = {
  codes: string[];
  count: number;
  /** 送ったタブ。同じタブには window イベントで届くので、BroadcastChannel 側では無視する。 */
  from?: string;
};

const CHANNEL = "topicstream-nu-hearts";
const TAB_ID = Math.random().toString(36).slice(2);

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
  if (typeof window === "undefined" || codes.length === 0 || count < 1) return;
  const spark: ChatHeartSpark = { codes, count: Math.round(count), from: TAB_ID };
  window.dispatchEvent(new CustomEvent("topicstream-hearts", { detail: spark }));
  try {
    new BroadcastChannel(CHANNEL).postMessage(spark);
  } catch {
    /* ignore */
  }
}

export function subscribeChatHearts(onSpark: (spark: ChatHeartSpark) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const local = (event: Event) => {
    const spark = (event as CustomEvent<ChatHeartSpark>).detail;
    if (spark?.codes?.length) onSpark(spark);
  };
  window.addEventListener("topicstream-hearts", local);
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event) => {
      const spark = event.data as ChatHeartSpark;
      if (spark?.from === TAB_ID) return;
      if (spark?.codes?.length) onSpark(spark);
    };
  } catch {
    channel = null;
  }
  return () => {
    window.removeEventListener("topicstream-hearts", local);
    channel?.close();
  };
}
