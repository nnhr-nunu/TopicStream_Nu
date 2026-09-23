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

/** Place hearts around a card so they stack instead of overlapping the label. */
export function heartOrbit(slot: number): HeartOrbit {
  const angle = ((slot * GOLDEN) % 360) * (Math.PI / 180);
  const radius = 42 + (slot % 4) * 7;
  return {
    dx: Math.round(Math.cos(angle) * radius),
    dy: Math.round(Math.sin(angle) * radius * 0.78),
    scale: 0.82 + (slot % 3) * 0.12,
  };
}

/** Persistent hearts sit on the frame (top/sides), never over the label. */
const FRAME_SLOTS: HeartOrbit[] = [
  { dx: -40, dy: -52, scale: 0.92 },
  { dx: 0, dy: -56, scale: 1 },
  { dx: 40, dy: -52, scale: 0.92 },
  { dx: -98, dy: -8, scale: 0.88 },
  { dx: 98, dy: -8, scale: 0.88 },
  { dx: -48, dy: 50, scale: 0.86 },
  { dx: 48, dy: 50, scale: 0.86 },
  { dx: 0, dy: 54, scale: 0.9 },
];

export function frameHeartOrbit(slot: number): HeartOrbit {
  const base = FRAME_SLOTS[slot % FRAME_SLOTS.length]!;
  const ring = Math.floor(slot / FRAME_SLOTS.length);
  return {
    dx: base.dx + (ring % 2 === 0 ? 0 : Math.sign(base.dx || 1) * 8),
    dy: base.dy + (ring > 0 ? Math.sign(base.dy || -1) * 6 : 0),
    scale: Math.max(0.72, base.scale - ring * 0.08),
  };
}

export function visibleFrameHeartCount(total: number): number {
  return Math.max(0, Math.min(8, Math.round(total)));
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
