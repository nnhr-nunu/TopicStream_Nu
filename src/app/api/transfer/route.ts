import { clientKeyFromHeaders } from "@/lib/gemini-guard";
import { createRateLimit, readJsonBody, tooManyRequests } from "@/lib/rate-limit";
import { TRANSFER_MAX_CHARS } from "@/lib/transfer";
import { readTransfer, saveTransfer } from "@/lib/transfer-store";

/** 預けるのはたまにしか使わないので少なめ。受け取りは、預かり番号の当てずっぽうを防ぐために絞る */
const saveLimit = createRateLimit(8, 10 * 60_000);
const readLimit = createRateLimit(20, 10 * 60_000);

/** 別の端末への引き継ぎ: ブラウザで暗号化された文を 15 分だけ預かる（中身はサーバーでは読めない） */
export async function POST(request: Request) {
  if (!saveLimit(clientKeyFromHeaders(request.headers))) return tooManyRequests(120);
  const body = await readJsonBody<{ id?: unknown; data?: unknown }>(request, TRANSFER_MAX_CHARS + 200);
  if (!body) return Response.json({ error: "引き継ぐ内容が大きすぎます" }, { status: 413 });
  if (typeof body.id !== "string" || typeof body.data !== "string") {
    return Response.json({ error: "形が正しくありません" }, { status: 400 });
  }
  const result = await saveTransfer(body.id, body.data);
  if (!result.ok) {
    return result.reason === "invalid"
      ? Response.json({ error: "形が正しくありません" }, { status: 400 })
      : Response.json({ error: "預かれませんでした" }, { status: 503 });
  }
  return Response.json({ expiresAt: result.expiresAt }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  if (!readLimit(clientKeyFromHeaders(request.headers))) return tooManyRequests(120);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const data = await readTransfer(id);
  if (!data) return Response.json({ error: "見つかりませんでした" }, { status: 404 });
  return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
