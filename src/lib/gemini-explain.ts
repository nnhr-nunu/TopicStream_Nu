import { GEMINI_HOST } from "@/lib/constants";
import { buildExplainPrompt, parseExplanation } from "@/lib/explain";
import {
  fallbackModels,
  geminiDebug,
  GeminiRequestError,
  parseGoogleError,
  shouldTryNextModel,
  thinkingConfigFor,
} from "@/lib/gemini-core";
import type { BoardMode } from "@/lib/types";

/** 1つのモデルを待つ上限と、全体の上限（解説は読むだけなので、話題づくりより短く切り上げる） */
const EXPLAIN_TIMEOUT_MS = 10_000;
const EXPLAIN_DEADLINE_MS = 20_000;

/**
 * 「これって何？」の解説をサーバーから Gemini に頼む（サーバー専用。キーは外に出さない）。
 * 文は短いのでストリームせず 1 回で受け取り、混んでいれば次のモデルへ回す。
 */
export async function requestExplanation(options: {
  label: string;
  context: string[];
  mode: BoardMode;
  apiKey: string;
  model: string;
}): Promise<{ text: string; model: string }> {
  const started = Date.now();
  const prompt = buildExplainPrompt(options.label, options.context, options.mode);
  let lastError: GeminiRequestError | undefined;
  for (const model of fallbackModels(options.model)) {
    const left = EXPLAIN_DEADLINE_MS - (Date.now() - started);
    if (left < 2_000) break;
    try {
      const text = parseExplanation(await generateOnce(model, prompt, options.apiKey, Math.min(EXPLAIN_TIMEOUT_MS, left)));
      if (text) return { text, model };
      lastError = new GeminiRequestError("http", geminiDebug({ reason: "empty", model }));
    } catch (error) {
      lastError =
        error instanceof GeminiRequestError
          ? error
          : new GeminiRequestError("network", geminiDebug({ reason: "network", model }));
      if (!shouldTryNextModel(lastError)) break;
    }
  }
  throw lastError ?? new GeminiRequestError("timeout", geminiDebug({ reason: "deadline", model: options.model }));
}

async function generateOnce(model: string, prompt: string, apiKey: string, timeoutMs: number, plain = false): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const thinking = plain ? undefined : thinkingConfigFor(model);
  try {
    const response = await fetch(`https://${GEMINI_HOST}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024, ...(thinking ? { thinkingConfig: thinking } : {}) },
      }),
    });
    const json = (await response.json().catch(() => null)) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
    } | null;
    if (!response.ok) {
      const google = parseGoogleError(json);
      // 思考の指定を知らないモデルなら、付けずにもう一度
      if (response.status === 400 && google.googleStatus === "INVALID_ARGUMENT" && thinking) {
        clearTimeout(timer);
        return generateOnce(model, prompt, apiKey, timeoutMs, true);
      }
      throw new GeminiRequestError(
        "http",
        geminiDebug({ reason: `http-${response.status}`, httpStatus: response.status, model, ...google }),
      );
    }
    return (
      json?.candidates?.[0]?.content?.parts
        ?.filter((part) => !part.thought)
        .map((part) => part.text ?? "")
        .join("") ?? ""
    );
  } catch (error) {
    if (error instanceof GeminiRequestError) throw error;
    if (controller.signal.aborted) throw new GeminiRequestError("timeout", geminiDebug({ reason: "timeout", model }));
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
