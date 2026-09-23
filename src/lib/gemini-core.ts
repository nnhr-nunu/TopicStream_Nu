import { DEFAULT_MODEL, GEMINI_FALLBACK_MODELS, GEMINI_HOST, LABEL_MAX, resolveGeminiModel } from "@/lib/constants";
import { redactSecret } from "@/lib/env-secret";
import type { GeminiDebug } from "@/lib/types";

export type { GeminiDebug };

export function buildPrompt(seed: string, existing: string[], count: number): string {
  const banned = existing.slice(0, 24).join(" / ") || "なし";
  return `あなたはVTuberの雑談配信アドバイザーです。
お題「${seed}」から、配信で話が自然に広がる関連キーワードを${count}個出してください。

条件:
- 日本語のみ
- 各キーワードは2〜${LABEL_MAX}文字の短い名詞句
- 番号・説明・引用符は付けない
- お題そのものは繰り返さない
- 次と重複しない: ${banned}
- 体験・比較・失敗・推し・あるあるなど、すぐ話せる具体寄り

JSON配列だけを返すこと。例: ["キーワード1","キーワード2"]`;
}

function clip(label: string): string {
  const trimmed = label.replace(/^[0-9]+[\.\):]\s*/, "").replace(/^[-・]\s*/, "").trim();
  if (trimmed.length <= LABEL_MAX) return trimmed;
  return `${trimmed.slice(0, LABEL_MAX - 1)}…`;
}

export function parseTopics(raw: string, seed: string, existing: string[]): string[] {
  const match = raw.match(/\[[\s\S]*\]/);
  let values: unknown[] = [];
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as unknown;
      if (Array.isArray(parsed)) values = parsed;
    } catch {
      values = [];
    }
  }
  if (values.length === 0) {
    values = raw
      .split(/[\n,、]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  const banned = new Set([seed.trim(), ...existing.map((item) => item.trim())]);
  const topics: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const label = clip(value);
    if (!label || banned.has(label) || topics.includes(label)) continue;
    topics.push(label);
  }
  return topics;
}

export const GEMINI_TIMEOUT_MS = 12_000;

export class GeminiRequestError extends Error {
  constructor(
    readonly kind: "http" | "timeout" | "network",
    readonly debug: GeminiDebug,
  ) {
    super("gemini");
    this.name = "GeminiRequestError";
  }

  get status(): number | undefined {
    return this.debug.httpStatus;
  }
}

function isAbortError(error: unknown, aborted: boolean): boolean {
  if (aborted) return true;
  let current: unknown = error;
  for (let i = 0; i < 5 && current && typeof current === "object"; i += 1) {
    const name = (current as { name?: string }).name;
    if (name === "AbortError" || name === "TimeoutError") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

function clipGoogleText(raw: string): string {
  return redactSecret(raw).replace(/\s+/g, " ").trim().slice(0, 160);
}

export function parseGoogleError(body: unknown): { googleStatus?: string; googleMessage?: string } {
  if (!body || typeof body !== "object") return {};
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== "object") return {};
  const record = error as { status?: unknown; message?: unknown };
  return {
    googleStatus: typeof record.status === "string" ? record.status : undefined,
    googleMessage: typeof record.message === "string" ? clipGoogleText(record.message) : undefined,
  };
}

function kindFromReason(reason: string): string {
  if (reason.startsWith("http-")) return "http";
  if (reason === "timeout") return "timeout";
  if (reason === "missing-key") return "missing-key";
  if (reason === "empty") return "empty";
  if (reason === "proxy") return "network";
  return "network";
}

export function geminiDebug(partial: Omit<GeminiDebug, "host" | "kind"> & { host?: string; kind?: string }): GeminiDebug {
  const { kind: explicitKind, ...rest } = partial;
  return {
    host: GEMINI_HOST,
    ...rest,
    kind: explicitKind ?? kindFromReason(partial.reason),
  };
}

export function geminiFailureWarning(error: unknown): string {
  const debug = error instanceof GeminiRequestError ? error.debug : undefined;
  const reason = debug?.reason ?? "network";
  const model = debug?.model ?? "";
  const google = debug?.googleStatus ? ` ${debug.googleStatus}` : "";
  if (reason.startsWith("http-") && ["http-400", "http-401", "http-403"].includes(reason)) {
    return `Gemini がキーを受け付けませんでした（${reason}${google}・${model}）。オフライン生成を使いました。`;
  }
  if (reason === "http-429" || reason === "http-503" || debug?.googleStatus === "UNAVAILABLE" || debug?.googleStatus === "RESOURCE_EXHAUSTED") {
    return `Gemini が混み合っています（${reason}${google}・${model}）。オフライン生成を使いました。`;
  }
  if (reason === "http-404") {
    return `Gemini のモデルが見つかりません（${reason}・${model}）。オフライン生成を使いました。`;
  }
  if (reason.startsWith("http-")) {
    return `Gemini がエラーを返しました（${reason}${google}・${model}）。オフライン生成を使いました。`;
  }
  if (reason === "timeout") {
    return `Gemini が時間切れです（timeout・12秒・${model}）。オフライン生成を使いました。`;
  }
  if (reason === "missing-key") {
    return "Vercel の GEMINI_API_KEY が空です。Preview にも入れて再デプロイしてください。オフライン生成を使いました。";
  }
  return `Gemini に届きませんでした（${reason}・${GEMINI_HOST}・${model}）。オフライン生成を使いました。`;
}

export function fallbackModels(requested: string): string[] {
  const start = resolveGeminiModel(requested);
  const extras = [DEFAULT_MODEL, ...GEMINI_FALLBACK_MODELS];
  return [start, ...extras.filter((model) => model !== start)];
}

export function shouldTryNextModel(error: GeminiRequestError): boolean {
  const status = error.debug.httpStatus;
  const google = error.debug.googleStatus;
  return status === 404 || google === "NOT_FOUND" || status === 503 || google === "UNAVAILABLE";
}

function networkError(model: string, error: unknown): GeminiRequestError {
  const name =
    error && typeof error === "object" && typeof (error as { name?: unknown }).name === "string"
      ? (error as { name: string }).name
      : "Error";
  return new GeminiRequestError(
    "network",
    geminiDebug({
      reason: "network",
      kind: "network",
      model,
      googleMessage: clipGoogleText(name),
    }),
  );
}

export async function requestGemini(options: {
  seed: string;
  existing: string[];
  apiKey: string;
  model: string;
  count: number;
}): Promise<{ topics: string[]; model: string; tried: string[] }> {
  const tried: string[] = [];
  let lastError: GeminiRequestError | undefined;
  const deadline = Date.now() + GEMINI_TIMEOUT_MS;
  for (const model of fallbackModels(options.model)) {
    tried.push(model);
    try {
      const topics = await requestGeminiOnce({ ...options, model, deadline });
      return { topics, model, tried };
    } catch (error) {
      lastError = error instanceof GeminiRequestError ? error : networkError(model, error);
      lastError.debug.tried = [...tried];
      if (shouldTryNextModel(lastError)) continue;
      throw lastError;
    }
  }
  throw lastError ?? networkError(options.model, undefined);
}

async function requestGeminiOnce(options: {
  seed: string;
  existing: string[];
  apiKey: string;
  model: string;
  count: number;
  deadline: number;
}): Promise<string[]> {
  const remaining = options.deadline - Date.now();
  if (remaining < 400) {
    throw new GeminiRequestError("timeout", geminiDebug({ reason: "timeout", kind: "timeout", model: options.model }));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remaining);
  const endpoint = `https://${GEMINI_HOST}/v1beta/models/${encodeURIComponent(options.model)}:generateContent`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": options.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(options.seed, options.existing, options.count) }] }],
        generationConfig: {
          temperature: 0.95,
          maxOutputTokens: 320,
        },
      }),
    });
    if (!response.ok) {
      const google = parseGoogleError(await response.json().catch(() => null));
      throw new GeminiRequestError(
        "http",
        geminiDebug({
          reason: `http-${response.status}`,
          httpStatus: response.status,
          model: options.model,
          ...google,
        }),
      );
    }
    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: unknown;
    };
    if (json.error) {
      const google = parseGoogleError(json);
      throw new GeminiRequestError(
        "http",
        geminiDebug({
          reason: "http-200-error",
          httpStatus: 200,
          model: options.model,
          ...google,
        }),
      );
    }
    const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
    return parseTopics(text, options.seed, options.existing);
  } catch (error) {
    if (error instanceof GeminiRequestError) throw error;
    if (isAbortError(error, controller.signal.aborted)) {
      throw new GeminiRequestError("timeout", geminiDebug({ reason: "timeout", model: options.model }));
    }
    throw networkError(options.model, error);
  } finally {
    clearTimeout(timer);
  }
}
