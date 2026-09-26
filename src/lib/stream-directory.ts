import { parseStreamUrl, type StreamRef } from "@/lib/stream-url";

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

/** 開発者の開発配信。終わった枠でも「このサービスを使った配信」として載せておく */
export const SEED_PUBLIC_STREAMS: PublicStream[] = [
  {
    id: "stream_dev_nunuhara",
    title: "【開発作業】①エゴサ支援、②雑談配信支援、③心音配信連携、④推し活支援サービスなどの開発【Claude Opus5.5/GPT6/Grok】",
    streamer: "ぬぬはら（開発者）",
    platform: "youtube",
    url: "https://www.youtube.com/watch?v=NUCX55gmkkM",
    live: false,
    updatedAt: Date.parse("2026-09-25T00:00:00+09:00"),
  },
];

/** 同じ枠を1行にまとめるための正規の URL（Studio のチャット URL なども本編の URL にそろえる） */
export function canonicalStreamUrl(ref: StreamRef): string {
  return ref.kind === "youtube"
    ? `https://www.youtube.com/watch?v=${ref.videoId}`
    : `https://www.twitch.tv/${ref.channel.toLowerCase()}`;
}

/**
 * 一覧に出すサムネイル。API キー無しで取れる公開画像だけを使う。
 * YouTube は動画 ID から、Twitch はライブ中だけプレビュー画像がある（終わった枠は出さない）。
 */
export function streamThumbnailUrl(stream: Pick<PublicStream, "url" | "live">): string | undefined {
  const ref = parseStreamUrl(stream.url);
  if (!ref) return undefined;
  if (ref.kind === "youtube") return `https://i.ytimg.com/vi/${ref.videoId}/mqdefault.jpg`;
  if (!stream.live) return undefined;
  return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${ref.channel.toLowerCase()}-320x180.jpg`;
}

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
    url: canonicalStreamUrl(ref),
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
