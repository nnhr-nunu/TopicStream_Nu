export type StreamRef =
  | { kind: "youtube"; videoId: string; url: string }
  | { kind: "twitch"; channel: string; url: string };

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

  if (host === "youtu.be") {
    const videoId = url.pathname.split("/").filter(Boolean)[0];
    if (videoId) return { kind: "youtube", videoId, url: url.toString() };
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const videoId =
      url.searchParams.get("v") ||
      (url.pathname.startsWith("/live/") ? url.pathname.split("/")[2] : "") ||
      (url.pathname.startsWith("/watch/") ? url.pathname.split("/")[2] : "");
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
