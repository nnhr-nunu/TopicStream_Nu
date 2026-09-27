import { DEFAULT_MODEL } from "@/lib/constants";
import { readGeminiApiKey, sanitizeSecret } from "@/lib/env-secret";
import { offlineExplanation, type Explanation } from "@/lib/explain";
import { geminiUserNotice, GeminiRequestError } from "@/lib/gemini-core";
import { requestExplanation } from "@/lib/gemini-explain";
import { clientKeyFromHeaders, createGeminiGuard } from "@/lib/gemini-guard";
import { parseMode } from "@/lib/modes";

export const maxDuration = 25;

/** 話題づくりとは別に数える（解説を読んだせいで広げられなくならないように） */
const guard = createGeminiGuard();

/** 同じカードの解説は使い回す（キーは言葉と流れ。インスタンスが生きている間だけ） */
const cache = new Map<string, string>();
const CACHE_ENTRIES = 300;

type Reply = Explanation & { warning?: string };

const NOTICE = {
  quota: "AI の利用上限に達したので、いまは解説を出せません。",
  busy: "AI が混み合っていて、解説を出せませんでした。",
  slow: "AI の応答が遅くて、解説を出せませんでした。",
  unavailable: "AI を使えなかったので、解説を出せませんでした。",
} as const;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    label?: unknown;
    context?: unknown;
    mode?: unknown;
    model?: unknown;
    apiKey?: unknown;
  } | null;

  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 80) : "";
  if (!label) return Response.json({ error: "言葉が空です" }, { status: 400 });
  const context = Array.isArray(body?.context)
    ? body.context
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 48))
        .filter(Boolean)
        .slice(0, 3)
    : [];
  const mode = parseMode(body?.mode);
  const model = typeof body?.model === "string" && body.model.trim() ? body.model.trim() : DEFAULT_MODEL;
  const override = typeof body?.apiKey === "string" ? sanitizeSecret(body.apiKey) : "";
  const apiKey = override || readGeminiApiKey();
  const offline = offlineExplanation(label, context);
  const reply = (value: Reply) => Response.json(value);

  if (!apiKey) return reply(offline);

  const cacheKey = `${mode}|${label}|${context.join("›")}`;
  const cached = cache.get(cacheKey);
  if (cached) return reply({ ...offline, text: cached, source: "gemini" });

  const slot = guard.acquire(clientKeyFromHeaders(request.headers));
  if (!slot.ok) {
    return reply({ ...offline, warning: "続けてたくさん調べたので、少し待ってからもう一度どうぞ。" });
  }
  try {
    const { text } = await requestExplanation({ label, context, mode, apiKey, model });
    cache.set(cacheKey, text);
    if (cache.size > CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return reply({ ...offline, text, source: "gemini" });
  } catch (error) {
    if (error instanceof GeminiRequestError) console.info("[explain]", JSON.stringify(error.debug));
    return reply({ ...offline, warning: NOTICE[geminiUserNotice(error).kind] });
  } finally {
    slot.release();
  }
}
