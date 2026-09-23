export type StreamRef =
  | { kind: "youtube"; videoId: string; url: string }
  | { kind: "twitch"; channel: string; url: string };

const YOUTUBE_VIDEO_ID = /^[\w-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "studio.youtube.com",
]);

function takeVideoId(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const id = value.split(/[/?#]/)[0];
  return id && YOUTUBE_VIDEO_ID.test(id) ? id : undefined;
}

function youtubeVideoId(url: URL, host: string): string | undefined {
  const fromQuery = takeVideoId(url.searchParams.get("v"));
  if (fromQuery) return fromQuery;

  const parts = url.pathname.split("/").filter(Boolean);
  if (host === "youtu.be") return takeVideoId(parts[0]);

  const prefix = parts[0];
  if (prefix === "video" || prefix === "live" || prefix === "watch" || prefix === "embed" || prefix === "shorts") {
    return takeVideoId(parts[1]);
  }
  return undefined;
}

export function parseStreamUrl(raw: string): StreamRef | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be" || YOUTUBE_HOSTS.has(host)) {
    const videoId = youtubeVideoId(url, host);
    if (videoId) return { kind: "youtube", videoId, url: url.toString() };
  }
  if (host === "twitch.tv" || host === "m.twitch.tv") {
    const channel = url.pathname.split("/").filter(Boolean)[0];
    if (channel && !["videos", "directory", "settings"].includes(channel.toLowerCase())) {
      return { kind: "twitch", channel, url: url.toString() };
    }
  }
  return null;
}

export function streamLabel(ref: StreamRef): string {
  if (ref.kind === "youtube") return "YouTube";
  return "Twitch";
}
