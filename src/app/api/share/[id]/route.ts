import { getShare } from "@/lib/live-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const share = await getShare(id).catch(() => undefined);
  // 保存先が一時的に読めないときは 404 にしない（見る画面が「リンクが間違っている」と出さないように）
  if (share === undefined) return Response.json({ error: "いまは読めません" }, { status: 503 });
  if (!share) return Response.json({ error: "見つかりません" }, { status: 404 });
  // 同じ秒に大勢が見ているときは、配信網に 1 秒だけ置いた答えを返す（保存先の読み取りをまとめる）
  return Response.json(share, { headers: { "Cache-Control": "public, s-maxage=1" } });
}
