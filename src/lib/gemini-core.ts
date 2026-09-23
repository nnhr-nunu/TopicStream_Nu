import {
  DEFAULT_MODEL,
  GEMINI_FALLBACK_MODELS,
  GEMINI_HOST,
  LABEL_MAX,
  RETIRED_GEMINI_MODELS,
} from "@/lib/constants";
import { redactSecret } from "@/lib/env-secret";
import type { GeminiDebug } from "@/lib/types";

export type { GeminiDebug };

export function buildPrompt(seed: string, existing: string[], count: number): string {
  const banned = existing.slice(0, 24).join(" / ") || "なし";
  return `あなたはVTuberの雑談配信アドバイザーです。
お題「${seed}」から、配信で話が自然に広がる関連キーワードをちょうど${count}個出してください。

条件:
- 日本語のみ
- 各キーワードは2〜${LABEL_MAX}文字の短い名詞句
- 番号・箇条書き記号・説明・引用符・Markdown・コードフェンスは付けない
- お題そのものは繰り返さない
- 次と重複しない: ${banned}
- 体験・比較・失敗・推し・あるあるなど、すぐ話せる具体寄り

出力は JSON 配列だけ。要素はちょうど${count}個。前後に文字を付けない。
例: ["キーワード1","キーワード2","キーワード3","キーワード4","キーワード5","キーワード6","キーワード7","キーワード8"]`;
}

function clip(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length <= LABEL_MAX) return trimmed;
  return `${trimmed.slice(0, LABEL_MAX - 1)}…`;
}

function unwrapFences(raw: string): string {
  return raw.replace(/```(?:json|javascript|js)?/gi, "").replace(/```/g, "").trim();
}

function tryParseJsonArray(raw: string): string[] | null {
  const text = unwrapFences(raw);
  const attempts: string[] = [text];
  const bracket = text.match(/\[[\s\S]*\]/);
  if (bracket) attempts.push(bracket[0]);
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      /* 壊れた JSON は後段で拾う */
    }
  }
  return null;
}

function extractQuoted(raw: string): string[] {
  const out: string[] = [];
  const closed = /"((?:\\.|[^"\\])*)"/g;
  let match: RegExpExecArray | null;
  while ((match = closed.exec(raw))) {
    out.push(match[1].replace(/\\"/g, '"').replace(/\\n/g, " "));
  }
  const jp = /[「『]([^」』]+)[」』]/g;
  while ((match = jp.exec(raw))) {
    out.push(match[1]);
  }
  if (out.length > 0) return out;
  const unclosed = raw.match(/"([^"\n\]]+)/);
  if (unclosed?.[1]) return [unclosed[1]];
  return [];
}

function stripDecorations(value: string): string {
  let text = value.replace(/\s+/g, " ").trim();
  text = text.replace(/^[0-9]+[A-Ia-i]\s*/, "");
  text = text.replace(/^[0-9]+[\.\):、]\s*/, "");
  text = text.replace(/^[-*・\u30fb]\s*/, "");
  for (let i = 0; i < 4; i += 1) {
    const next = text
      .replace(/^[\s\[\]\{\}「『"'`]+/, "")
      .replace(/[\s\[\]\{\}」』"'`,;]+$/, "")
      .trim();
    if (next === text) break;
    text = next;
  }
  return text;
}

export function isJunkTopic(label: string): boolean {
  const text = label.trim();
  if (!text) return true;
  if (/^[\[\]\{\}"'`「」『』,.:;\\/]+$/.test(text)) return true;
  if (/^[\[\]\{\}"',]/.test(text)) return true;
  if (/^[0-9]+[A-Ia-i]\s*[\[\]"']/.test(text)) return true;
  const letters = text.replace(/[\s\[\]\{\}"'`.,!?！？、。・\-…]/g, "");
  return letters.length === 0;
}

export function parseTopics(raw: string, seed: string, existing: string[]): string[] {
  const text = unwrapFences(raw);
  const fromJson = tryParseJsonArray(text);
  const quoted = extractQuoted(text);
  const values: unknown[] =
    fromJson && fromJson.length > 0
      ? fromJson
      : quoted.length > 0
        ? quoted
        : text
            .split(/[\n,、]/)
            .map((part) => part.trim())
            .filter(Boolean);

  const banned = new Set([seed.trim(), ...existing.map((item) => item.trim())]);
  const topics: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const label = clip(stripDecorations(value));
    if (!label || isJunkTopic(label) || banned.has(label) || topics.includes(label)) continue;
    topics.push(label);
  }
  return topics;
}

export function padTopics(parsed: string[], fallback: string[], count: number, seed: string): string[] {
  const out = [...parsed];
  const banned = new Set([seed.trim(), ...out]);
  for (const item of fallback) {
    if (out.length >= count) break;
    const label = clip(stripDecorations(item));
    if (!label || isJunkTopic(label) || banned.has(label)) continue;
    out.push(label);
    banned.add(label);
  }
  return out.slice(0, count);
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

export function geminiDebug(partial: Omit<GeminiDebug, "host"> & { host?: string }): GeminiDebug {
  return { host: GEMINI_HOST, ...partial };
}

export function geminiFailureWarning(error: unknown): string {
  const debug = error instanceof GeminiRequestError ? error.debug : undefined;
  const reason = debug?.reason ?? "network";
  const model = debug?.model ?? "";
  const google = debug?.googleStatus ? ` ${debug.googleStatus}` : "";
  if (reason.startsWith("http-") && ["http-400", "http-401", "http-403"].includes(reason)) {
    return `Gemini がキーを受け付けませんでした（${reason}${google}・${model}）。オフライン生成を使いました。`;
  }
  if (
    reason === "http-429" ||
    reason === "http-503" ||
    debug?.googleStatus === "UNAVAILABLE" ||
    debug?.googleStatus === "RESOURCE_EXHAUSTED"
  ) {
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

/** テストで待ちを潰す。本番は短いバックオフと最後の 1.5 秒待ち。 */
export const geminiRetry = {
  sameModelMs: 350,
  lastModelMs: 1_500,
  sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  },
};

export function resolveGeminiModel(requested: string): string {
  const trimmed = requested.trim();
  if (!trimmed || (RETIRED_GEMINI_MODELS as readonly string[]).includes(trimmed)) {
    return DEFAULT_MODEL;
  }
  return trimmed;
}

export function fallbackModels(requested: string): string[] {
  const start = resolveGeminiModel(requested);
  const seen = new Set<string>();
  const models: string[] = [];
  for (const model of [start, ...GEMINI_FALLBACK_MODELS]) {
    if (seen.has(model)) continue;
    seen.add(model);
    models.push(model);
  }
  return models;
}

export function isGeminiBusyError(error: GeminiRequestError): boolean {
  const status = error.debug.httpStatus;
  const google = error.debug.googleStatus;
  return (
    status === 429 ||
    status === 503 ||
    google === "UNAVAILABLE" ||
    google === "RESOURCE_EXHAUSTED"
  );
}

export function shouldTryNextModel(error: GeminiRequestError): boolean {
  const status = error.debug.httpStatus;
  const google = error.debug.googleStatus;
  if (status === 404 || google === "NOT_FOUND") return true;
  return isGeminiBusyError(error);
}

function shouldRetrySameModel(error: GeminiRequestError): boolean {
  return error.debug.httpStatus === 429 || error.debug.httpStatus === 503 || isGeminiBusyError(error);
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
      model,
      googleMessage: clipGoogleText(name),
    }),
  );
}

async function requestGeminiWithSameModelRetry(options: {
  seed: string;
  existing: string[];
  apiKey: string;
  model: string;
  count: number;
}): Promise<string[]> {
  try {
    return await requestGeminiOnce(options);
  } catch (error) {
    const first = error instanceof GeminiRequestError ? error : networkError(options.model, error);
    if (!shouldRetrySameModel(first)) throw first;
    await geminiRetry.sleep(geminiRetry.sameModelMs);
    return requestGeminiOnce(options);
  }
}

export async function requestGemini(options: {
  seed: string;
  existing: string[];
  apiKey: string;
  model: string;
  count: number;
}): Promise<{ topics: string[]; model: string; tried: string[] }> {
  const tried: string[] = [];
  const models = fallbackModels(options.model);
  let lastError: GeminiRequestError | undefined;

  for (const model of models) {
    tried.push(model);
    try {
      const topics = await requestGeminiWithSameModelRetry({ ...options, model });
      return { topics, model, tried };
    } catch (error) {
      lastError = error instanceof GeminiRequestError ? error : networkError(model, error);
      lastError.debug.tried = [...tried];
      if (shouldTryNextModel(lastError)) continue;
      throw lastError;
    }
  }

  const lastModel = models[models.length - 1];
  if (lastError && isGeminiBusyError(lastError) && lastModel) {
    await geminiRetry.sleep(geminiRetry.lastModelMs);
    try {
      const topics = await requestGeminiOnce({ ...options, model: lastModel });
      return { topics, model: lastModel, tried };
    } catch (error) {
      lastError = error instanceof GeminiRequestError ? error : networkError(lastModel, error);
      lastError.debug.tried = [...tried];
    }
  }

  throw lastError ?? networkError(options.model, undefined);
}

async function generateGeminiText(options: {
  seed: string;
  existing: string[];
  apiKey: string;
  model: string;
  count: number;
}): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
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
    return json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
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

function mergeParsedTopics(base: string[], extra: string[], count: number): string[] {
  const topics = [...base];
  for (const item of extra) {
    if (topics.length >= count) break;
    if (!topics.includes(item)) topics.push(item);
  }
  return topics;
}

async function requestGeminiOnce(options: {
  seed: string;
  existing: string[];
  apiKey: string;
  model: string;
  count: number;
}): Promise<string[]> {
  const first = parseTopics(await generateGeminiText(options), options.seed, options.existing);
  if (first.length >= options.count) return first.slice(0, options.count);
  try {
    const retry = parseTopics(await generateGeminiText(options), options.seed, [...options.existing, ...first]);
    return mergeParsedTopics(first, retry, options.count);
  } catch {
    return first;
  }
}
