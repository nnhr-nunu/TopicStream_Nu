const CHANNEL = "topicstream-nu-pulse";

export function emitPulse(codes: string[]) {
  if (typeof window === "undefined" || codes.length === 0) return;
  window.dispatchEvent(new CustomEvent("topicstream-pulse", { detail: codes }));
  try {
    new BroadcastChannel(CHANNEL).postMessage(codes);
  } catch {
    /* ignore */
  }
}

export function subscribePulse(onCodes: (codes: string[]) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const local = (event: Event) => {
    const codes = (event as CustomEvent<string[]>).detail;
    if (Array.isArray(codes)) onCodes(codes);
  };
  window.addEventListener("topicstream-pulse", local);
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event) => {
      if (Array.isArray(event.data)) onCodes(event.data);
    };
  } catch {
    channel = null;
  }
  return () => {
    window.removeEventListener("topicstream-pulse", local);
    channel?.close();
  };
}
