import { getShare } from "@/lib/live-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const share = getShare(id);
  if (!share) return Response.json({ error: "見つかりません" }, { status: 404 });
  return Response.json(share);
}
