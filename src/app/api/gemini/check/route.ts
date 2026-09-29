import { readGeminiApiKey, sanitizeSecret } from "@/lib/env-secret";
import { checkGeminiKey } from "@/lib/gemini-core";
import { allowedModel, clientKeyFromHeaders } from "@/lib/gemini-guard";
import { createRateLimit, tooManyRequests } from "@/lib/rate-limit";

export const maxDuration = 30;

/** 接続テストはモデル一覧と生成を呼ぶので、連打で枠を使わせない */
const limit = createRateLimit(6, 60_000);

/** 設定画面の「接続テスト」。キーそのものは返さない。 */
export async function POST(request: Request) {
  if (!limit(clientKeyFromHeaders(request.headers))) return tooManyRequests(60);
  const body = (await request.json().catch(() => null)) as { apiKey?: unknown; model?: unknown } | null;
  const override = typeof body?.apiKey === "string" ? sanitizeSecret(body.apiKey) : "";
  const apiKey = override || readGeminiApiKey();
  if (!apiKey) {
    return Response.json({ ok: false, source: "none", models: [] });
  }
  const model = allowedModel(body?.model, Boolean(override));
  const result = await checkGeminiKey(apiKey, model);
  return Response.json({ ...result, source: override ? "browser" : "server" });
}
