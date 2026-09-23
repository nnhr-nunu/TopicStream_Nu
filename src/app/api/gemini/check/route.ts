import { readGeminiApiKey, sanitizeSecret } from "@/lib/env-secret";
import { checkGeminiKey } from "@/lib/gemini-core";

/** 設定画面の「接続テスト」。キーそのものは返さない。 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { apiKey?: unknown } | null;
  const override = typeof body?.apiKey === "string" ? sanitizeSecret(body.apiKey) : "";
  const apiKey = override || readGeminiApiKey();
  if (!apiKey) {
    return Response.json({ ok: false, source: "none", models: [] });
  }
  const result = await checkGeminiKey(apiKey);
  return Response.json({ ...result, source: override ? "browser" : "server" });
}
