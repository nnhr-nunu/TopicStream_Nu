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

/** GitHub Pages でも見える、このサービスを使っている配信の見本。実キーは不要。 */
export const SEED_PUBLIC_STREAMS: PublicStream[] = [
  {
    id: "stream_nunu_monday",
    title: "月曜の雑談・地元あるある",
    streamer: "ぬぬはら",
    platform: "youtube",
    url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
    live: true,
    updatedAt: Date.parse("2026-09-23T07:00:00Z"),
  },
  {
    id: "stream_evening_rta",
    title: "はじめてのRTA夜話",
    streamer: "みのわ",
    platform: "twitch",
    url: "https://www.twitch.tv/twitch",
    live: true,
    updatedAt: Date.parse("2026-09-23T06:40:00Z"),
  },
  {
    id: "stream_osu_chat",
    title: "推し活の余韻をしゃべる",
    streamer: "あさひ",
    platform: "youtube",
    url: "https://www.youtube.com/watch?v=5qap5aO4i9A",
    live: false,
    updatedAt: Date.parse("2026-09-22T15:20:00Z"),
  },
];

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
