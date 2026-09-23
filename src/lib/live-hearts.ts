export type ChatHeartSpark = {
  codes: string[];
  count: number;
};

export type HeartOrbit = {
  dx: number;
  dy: number;
  scale: number;
};

const CHANNEL = "topicstream-nu-hearts";
const GOLDEN = 137.508;

/** Place hearts outside a mandala chip (~184×84) so they are not hidden behind the label. */
export function heartOrbit(slot: number): HeartOrbit {
  const angle = ((slot * GOLDEN) % 360) * (Math.PI / 180);
  const rx = 110 + (slot % 3) * 10;
  const ry = 62 + (slot % 3) * 8;
  return {
    dx: Math.round(Math.cos(angle) * rx),
    dy: Math.round(Math.sin(angle) * ry),
    scale: 0.9 + (slot % 3) * 0.14,
  };
}

export function emitChatHearts(codes: string[], count = 1) {
  if (typeof window === "undefined" || codes.length === 0 || count < 1) return;
  const spark: ChatHeartSpark = { codes, count: Math.min(8, Math.round(count)) };
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
