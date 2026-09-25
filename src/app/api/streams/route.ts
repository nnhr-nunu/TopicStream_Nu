import { listStreams, saveStream } from "@/lib/community-server";
import { mergePublicStreams, SEED_PUBLIC_STREAMS } from "@/lib/stream-directory";

export async function GET() {
  return Response.json({ streams: mergePublicStreams(SEED_PUBLIC_STREAMS, await listStreams()) });
}

/** 配信URLを連携した枠を一覧に載せる（連携中は定期的に呼ばれ、しばらく来なければ「ライブ」が外れる） */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: unknown; watchId?: unknown } | null;
  const stream = await saveStream({ url: body?.url, watchId: body?.watchId });
  if (!stream) {
    return Response.json({ error: "YouTubeかTwitchの配信URLを貼ってください" }, { status: 400 });
  }
  return Response.json({ stream });
}
