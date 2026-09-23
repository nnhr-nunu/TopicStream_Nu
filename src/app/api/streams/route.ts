import { mergePublicStreams, SEED_PUBLIC_STREAMS, type PublicStream } from "@/lib/stream-directory";
import { parseStreamUrl } from "@/lib/stream-url";

const extra: PublicStream[] = [];

export async function GET() {
  return Response.json({ streams: mergePublicStreams(SEED_PUBLIC_STREAMS, extra) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    streamer?: unknown;
    url?: unknown;
    watchId?: unknown;
  } | null;
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const ref = parseStreamUrl(url);
  if (!ref) {
    return Response.json({ error: "YouTubeかTwitchの配信URLを貼ってください" }, { status: 400 });
  }
  const stream: PublicStream = {
    id: `live_${Date.now()}`,
    title: typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 80) : "雑談配信",
    streamer: typeof body?.streamer === "string" && body.streamer.trim() ? body.streamer.trim().slice(0, 24) : "ななし",
    platform: ref.kind,
    url: ref.url,
    live: true,
    watchId: typeof body?.watchId === "string" ? body.watchId : undefined,
    updatedAt: Date.now(),
  };
  extra.unshift(stream);
  extra.splice(40);
  return Response.json({ stream, streams: mergePublicStreams(SEED_PUBLIC_STREAMS, extra) });
}
