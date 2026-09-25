import { parseStreamUrl } from "@/lib/stream-url";

export type PublicStream = {
  id: string;
  title: string;
  streamer: string;
  platform: "youtube" | "twitch";
  url: string;
  live: boolean;
  watchId?: string;
  updatedAt: number;
};

export function sortPublicStreams(streams: PublicStream[]): PublicStream[] {
  return [...streams].sort((a, b) => {
    if (a.live !== b.live) return a.live ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

export function publicStreamFromLink(opts: {
  url: string;
  title?: string;
  streamer?: string;
  watchId?: string;
}): PublicStream | null {
  const ref = parseStreamUrl(opts.url);
  if (!ref) return null;
  const key = ref.kind === "youtube" ? ref.videoId : ref.channel.toLowerCase();
  return {
    id: `linked_${ref.kind}_${key}`,
    title: (opts.title?.trim() || "いまの雑談").slice(0, 80),
    streamer: (opts.streamer?.trim() || "配信中").slice(0, 24),
    platform: ref.kind,
    url: ref.url,
    live: true,
    watchId: opts.watchId?.trim() || undefined,
    updatedAt: Date.now(),
  };
}

export function mergePublicStreams(...lists: PublicStream[][]): PublicStream[] {
  const byUrl = new Map<string, PublicStream>();
  for (const list of lists) {
    for (const stream of list) {
      const key = stream.url.replace(/\/+$/, "");
      const prev = byUrl.get(key);
      if (!prev) {
        byUrl.set(key, stream);
        continue;
      }
      byUrl.set(key, {
        ...prev,
        ...stream,
        id: prev.id,
        live: prev.live || stream.live,
        watchId: stream.watchId || prev.watchId,
        updatedAt: Math.max(prev.updatedAt, stream.updatedAt),
      });
    }
  }
  return sortPublicStreams([...byUrl.values()]);
}

export function watchMapHref(watchId?: string): string | undefined {
  if (!watchId?.trim()) return undefined;
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}/watch/?id=${encodeURIComponent(watchId.trim())}`;
}
