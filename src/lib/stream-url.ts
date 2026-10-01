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

/** Twitch のユーザー名は英数字と _ で 4〜25 文字 */
const TWITCH_CHANNEL = /^[A-Za-z0-9_]{4,25}$/;
const TWITCH_NESTED = new Set(["popout", "moderator", "embed", "u"]);
const TWITCH_RESERVED = new Set([
  "videos",
  "directory",
  "settings",
  "search",
  "downloads",
  "subscriptions",
  "inventory",
  "wallet",
  "drops",
  "friends",
  "messages",
  "turbo",
  "prime",
  "login",
  "signup",
  "following",
]);

function takeVideoId(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const id = value.split(/[/?#]/)[0];
  // embed/live_stream?channel=… は動画 ID ではない（11 文字なので形だけでは見分けられない）
  return id && id !== "live_stream" && YOUTUBE_VIDEO_ID.test(id) ? id : undefined;
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
  if (host === "twitch.tv" || host === "m.twitch.tv" || host === "dashboard.twitch.tv") {
    const parts = url.pathname.split("/").filter(Boolean);
    // チャットのポップアウト（/popout/名前/chat）・モデレーター画面・埋め込み・配信マネージャー（/u/名前/…）は 2 番目が配信者名
    const channel = TWITCH_NESTED.has(parts[0]?.toLowerCase() ?? "") ? parts[1] : parts[0];
    if (channel && TWITCH_CHANNEL.test(channel) && !TWITCH_RESERVED.has(channel.toLowerCase())) {
      return { kind: "twitch", channel, url: url.toString() };
    }
  }
  return null;
}

/** URL だけで分かる配信者名（Twitch のチャンネル名）。YouTube の URL には名前が無いので空 */
export function streamerFromUrl(raw: string): string {
  const ref = parseStreamUrl(raw);
  return ref?.kind === "twitch" ? ref.channel : "";
}

export function streamLabel(ref: StreamRef): string {
  if (ref.kind === "youtube") return "YouTube";
  return "Twitch";
}
