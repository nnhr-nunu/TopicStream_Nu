import { saveCommunityBoard } from "@/lib/community-server";
import { clientKeyFromHeaders } from "@/lib/gemini-guard";
import { createRateLimit, readJsonBody, tooManyRequests } from "@/lib/rate-limit";

/** 1 人で「みんなが作った話題マップ」を埋められないよう数を絞る（ふつうは操作が落ち着いたときに 1 回送るだけ） */
const limit = createRateLimit(10, 10 * 60_000);

/** ちゃんと使われたボードを「みんなが作った話題マップ」に載せる（メモは外す。条件に合わなければ何もしない） */
export async function POST(request: Request) {
  if (!limit(clientKeyFromHeaders(request.headers))) return tooManyRequests(10 * 60);
  const body = await readJsonBody<{ board?: unknown }>(request, 900_000);
  const saved = await saveCommunityBoard(body?.board);
  return Response.json({ saved });
}
