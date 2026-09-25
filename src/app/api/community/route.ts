import { saveCommunityBoard } from "@/lib/community-server";

/** ちゃんと使われたボードを「みんなのトークテーマ」に載せる（メモは外す。条件に合わなければ何もしない） */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { board?: unknown } | null;
  const saved = await saveCommunityBoard(body?.board);
  return Response.json({ saved });
}
