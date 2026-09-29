/**
 * 同じタブの購読者と、同じサイトの別タブ（配信画面に映すタブなど）へ小さな知らせを配る。
 * BroadcastChannel はタブで 1 つだけ開き、送ったタブ自身には届かないので二重に受け取らない。
 */
export function createLiveBus<T>(name: string, accept: (data: unknown) => T | null) {
  const listeners = new Set<(value: T) => void>();
  let channel: BroadcastChannel | null | undefined;

  const open = (): BroadcastChannel | null => {
    if (channel !== undefined) return channel;
    try {
      channel = new BroadcastChannel(name);
      channel.onmessage = (event) => {
        const value = accept(event.data);
        if (value === null) return;
        for (const listener of [...listeners]) listener(value);
      };
    } catch {
      channel = null;
    }
    return channel;
  };

  return {
    emit(value: T) {
      if (typeof window === "undefined") return;
      for (const listener of [...listeners]) listener(value);
      try {
        open()?.postMessage(value);
      } catch {
        /* 送れなくても、このタブの中には届いている */
      }
    },
    subscribe(listener: (value: T) => void): () => void {
      if (typeof window === "undefined") return () => undefined;
      listeners.add(listener);
      open();
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function asStringList(data: unknown): string[] | null {
  if (!Array.isArray(data)) return null;
  const list = data.filter((item): item is string => typeof item === "string" && item.length <= 12);
  return list.length > 0 ? list : null;
}
