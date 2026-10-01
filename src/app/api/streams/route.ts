import { listStreams, saveStream } from "@/lib/community-server";
import { clientKeyFromHeaders } from "@/lib/gemini-guard";
import { createRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { mergePublicStreams, SEED_PUBLIC_STREAMS } from "@/lib/stream-directory";

export async function GET() {
  return Response.json({ streams: mergePublicStreams(SEED_PUBLIC_STREAMS, await listStreams()) });
}

/** 配信URLを連携した枠を一覧に載せる（連携中は定期的に呼ばれ、しばらく来なければ「ライブ」が外れる） */
/** 連携中の画面は数分おきに知らせる。1 人で一覧を埋められないよう数を絞る */
const limit = createRateLimit(12, 60_000);

export async function POST(request: Request) {
  if (!limit(clientKeyFromHeaders(request.headers))) return tooManyRequests(60);
  const body = (await request.json().catch(() => null)) as { url?: unknown; watchId?: unknown; watchKey?: unknown } | null;
  const stream = await saveStream({ url: body?.url, watchId: body?.watchId, watchKey: body?.watchKey });
  if (!stream) {
    return Response.json({ error: "YouTubeかTwitchの配信URLを貼ってください" }, { status: 400 });
  }
  return Response.json({ stream });
}
