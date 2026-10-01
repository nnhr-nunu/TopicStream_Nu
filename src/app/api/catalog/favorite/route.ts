import { bumpCommunityFavorite } from "@/lib/community-server";
import { clientKeyFromHeaders } from "@/lib/gemini-guard";
import { bumpFavorite } from "@/lib/live-store";
import { createRateLimit, tooManyRequests } from "@/lib/rate-limit";

const limit = createRateLimit(30, 60_000);

export async function POST(request: Request) {
  if (!limit(clientKeyFromHeaders(request.headers))) return tooManyRequests(60);
  const body = (await request.json().catch(() => null)) as { id?: unknown; undo?: unknown } | null;
  const id = typeof body?.id === "string" && /^[\w-]{1,64}$/.test(body.id) ? body.id : "";
  if (!id) return Response.json({ error: "id が必要です" }, { status: 400 });
  // undo: 付けた ♡ を外す
  const delta = body?.undo === true ? -1 : 1;
  const favorites = (await bumpFavorite(id, delta)) ?? (await bumpCommunityFavorite(id, delta));
  if (favorites === null) return Response.json({ error: "ボードが見つかりません" }, { status: 404 });
  return Response.json({ id, favorites });
}
