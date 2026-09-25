import { bumpCommunityFavorite } from "@/lib/community-server";
import { bumpFavorite } from "@/lib/live-store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  const id = body?.id;
  if (!id) return Response.json({ error: "id が必要です" }, { status: 400 });
  const favorites = bumpFavorite(id) ?? (await bumpCommunityFavorite(id));
  if (favorites === null) return Response.json({ error: "ボードが見つかりません" }, { status: 404 });
  return Response.json({ id, favorites });
}
