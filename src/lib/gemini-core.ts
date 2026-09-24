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

/** 1回の呼び出しの上限。ストリーミングなので、時間切れでも届いた分は使う。 */
export const GEMINI_TIMEOUT_MS = 12_000;
/** モデルを替えて試す全体の上限。API route の maxDuration（30秒）より短くする。 */
export const GEMINI_DEADLINE_MS = 24_000;

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

/** 429 のうち「混雑」ではなく、キーのプロジェクトに割り当てが無い（無料枠 0・課金未設定など）もの。 */
export function isQuotaError(debug: GeminiDebug | undefined): boolean {
  if (!debug) return false;
  if (isBillingError(debug)) return true;
  if (debug.httpStatus !== 429) return false;
  const message = (debug.googleMessage ?? "").toLowerCase();
  return message.includes("quota") || message.includes("limit: 0") || message.includes("billing");
}

/** プリペイドのクレジット切れ・請求の未設定（HTTP 402 など）。モデルを替えても直らない。 */
export function isBillingError(debug: GeminiDebug | undefined): boolean {
  if (!debug) return false;
  const message = (debug.googleMessage ?? "").toLowerCase();
  return debug.httpStatus === 402 || message.includes("prepayment") || message.includes("credits are depleted");
}

function attemptsNote(debug: GeminiDebug | undefined): string {
  const attempts = debug?.attempts ?? [];
  return attempts.length > 1 ? `試したモデル: ${attempts.join(" / ")}。` : "";
}

export function geminiFailureWarning(error: unknown): string {
  const debug = error instanceof GeminiRequestError ? error.debug : undefined;
  const reason = debug?.reason ?? "network";
  const model = debug?.model ?? "";
  const google = debug?.googleStatus ? ` ${debug.googleStatus}` : "";
  const tail = `${attemptsNote(debug)}オフライン生成を使いました。`;
  if (["http-400", "http-401", "http-403"].includes(reason)) {
    return `Gemini がキーを受け付けませんでした（${reason}${google}・${model}）。キーの値と、AI Studio でキーのプロジェクトが有効か確認してください。${tail}`;
  }
  if (isBillingError(debug)) {
    return `Gemini のクレジットが尽きているか、請求が未設定です（${reason}${google}）。AI Studio でこのプロジェクトの請求とクレジット残高を確認してください。${tail}`;
  }
  if (isQuotaError(debug)) {
    return `このキーには ${model} の利用枠がありません（${reason}${google}）。AI Studio の使用量と上限、またはプロジェクトの課金設定を確認してください。${tail}`;
  }
  if (
    reason === "http-429" ||
    reason === "http-503" ||
    debug?.googleStatus === "UNAVAILABLE" ||
    debug?.googleStatus === "RESOURCE_EXHAUSTED"
  ) {
    return `Gemini が混み合っています（${reason}${google}・${model}）。${tail}`;
  }
  if (reason === "http-404") {
    return `Gemini のモデルが見つかりません（${reason}・${model}）。設定でモデルを選び直してください。${tail}`;
  }
  if (reason.startsWith("http-")) {
    return `Gemini がエラーを返しました（${reason}${google}・${model}）。${tail}`;
  }
  if (reason === "timeout") {
    return `Gemini が時間切れです（timeout・${GEMINI_TIMEOUT_MS / 1000}秒・${model}）。${tail}`;
  }
  if (reason === "deadline") {
    return `Gemini の応答を待ちきれませんでした（${GEMINI_DEADLINE_MS / 1000}秒）。${tail}`;
  }
  if (reason === "missing-key") {
    return "Vercel の GEMINI_API_KEY が空です。Preview にも入れて再デプロイしてください。オフライン生成を使いました。";
  }
  return `Gemini に届きませんでした（${reason}・${GEMINI_HOST}・${model}）。${tail}`;
}

export type GeminiNoticeKind = "quota" | "busy" | "slow" | "unavailable";

/**
 * 利用者に見せる短いお知らせ。モデル名や試した順番などの技術的な中身は出さない
 * （それは debug とサーバーログに残す）。
 */
export function geminiUserNotice(error: unknown): { kind: GeminiNoticeKind; message: string } {
  const debug = error instanceof GeminiRequestError ? error.debug : undefined;
  const reason = debug?.reason ?? "network";
  if (isQuotaError(debug)) {
    return { kind: "quota", message: "AI の利用上限に達しました。しばらくはオフラインの候補で広げます。" };
  }
  if (reason === "http-429" || reason === "http-503" || debug?.googleStatus === "UNAVAILABLE" || debug?.googleStatus === "RESOURCE_EXHAUSTED") {
    return { kind: "busy", message: "AI が混み合っているので、今回はオフラインの候補で広げました。" };
  }
  if (reason === "timeout" || reason === "deadline") {
    return { kind: "slow", message: "AI の応答が遅いので、今回はオフラインの候補で広げました。" };
  }
  return { kind: "unavailable", message: "AI を使えなかったので、今回はオフラインの候補で広げました。" };
}

/** テストで待ちを潰す。本番は短いバックオフと、全部混んでいたときの最後の 1.5 秒待ち。 */
export const geminiRetry = {
  sameModelMs: 800,
  lastModelMs: 1_500,
  sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  },
  now() {
    return Date.now();
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
  if (isBillingError(error.debug)) return false; // 請求はプロジェクト単位。どのモデルでも同じ
  if (status === 404 || google === "NOT_FOUND") return true;
  if (error.kind === "timeout") return true;
  return isGeminiBusyError(error);
}

function shouldRetrySameModel(error: GeminiRequestError): boolean {
  // 割り当てが無い 429 は待っても通らないので、すぐ次のモデルへ
  return isGeminiBusyError(error) && !isQuotaError(error.debug);
}

/**
 * 思考（thinking）の量。2.5 / 3.x は既定で考えてから答えるため、短いキーワードでも遅くなり、
 * 思考のトークンが maxOutputTokens を食って空の返答にもなる。できるだけ小さくする。
 */
export function thinkingConfigFor(model: string): Record<string, unknown> | undefined {
  if (/^gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  if (/^gemini-3\.[78]-flash/.test(model)) return { thinkingLevel: "low" };
  if (/^gemini-3(\.[56])?-flash/.test(model)) return { thinkingLevel: "minimal" };
  return undefined;
}

/** 思考や JSON 指定を受け付けなかったモデル。以後はそれらを付けずに頼む。 */
const plainModels = new Set<string>();

type GeminiOptions = {
  seed: string;
  existing: string[];
  apiKey: string;
  model: string;
  count: number;
};

type Remaining = () => number;

function describeAttempt(error: GeminiRequestError): string {
  const google = error.debug.googleStatus ? ` ${error.debug.googleStatus}` : "";
  return `${error.debug.model}: ${error.debug.reason}${google}`;
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

async function requestGeminiWithSameModelRetry(
  options: GeminiOptions,
  remaining: Remaining,
  signal?: AbortSignal,
): Promise<string[]> {
  try {
    return await requestGeminiOnce(options, remaining, signal);
  } catch (error) {
    const first = error instanceof GeminiRequestError ? error : networkError(options.model, error);
    if (signal?.aborted || !shouldRetrySameModel(first) || remaining() < geminiRetry.sameModelMs + 3_000) throw first;
    await geminiRetry.sleep(geminiRetry.sameModelMs);
    if (signal?.aborted) throw first;
    return requestGeminiOnce(options, remaining, signal);
  }
}

/** 先頭のモデルがこの時間内に最初の返事をしなければ、次のモデルも同時に走らせる。 */
export const GEMINI_HEDGE_MS = 3_000;

export async function requestGemini(
  options: GeminiOptions,
): Promise<{ topics: string[]; model: string; tried: string[] }> {
  const started = geminiRetry.now();
  const remaining: Remaining = () => GEMINI_DEADLINE_MS - (geminiRetry.now() - started);
  const tried: string[] = [];
  const attempts: string[] = [];
  const models = fallbackModels(options.model);
  let lastError: GeminiRequestError | undefined;

  const record = (error: unknown, model: string) => {
    const failed = error instanceof GeminiRequestError ? error : networkError(model, error);
    attempts.push(describeAttempt(failed));
    failed.debug.tried = [...tried];
    failed.debug.attempts = [...attempts];
    return failed;
  };

  // 混んでいる日に1つずつ待つと遅いので、返事が遅いモデルがあれば次のモデルを重ねて走らせ、先に返ったほうを使う。
  const raced = await new Promise<{ topics: string[]; model: string } | GeminiRequestError | null>((resolve) => {
    const controllers: AbortController[] = [];
    let nextIndex = 0;
    let active = 0;
    let settled = false;
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (value: { topics: string[]; model: string } | GeminiRequestError | null) => {
      if (settled) return;
      settled = true;
      if (hedgeTimer) clearTimeout(hedgeTimer);
      for (const controller of controllers) controller.abort();
      resolve(value);
    };

    const launch = (): boolean => {
      if (settled || nextIndex >= models.length || remaining() < 3_000) return false;
      const model = models[nextIndex]!;
      nextIndex += 1;
      tried.push(model);
      active += 1;
      const controller = new AbortController();
      controllers.push(controller);
      requestGeminiWithSameModelRetry({ ...options, model }, remaining, controller.signal).then(
        (topics) => finish({ topics, model }),
        (error: unknown) => {
          active -= 1;
          if (settled) return;
          lastError = record(error, model);
          if (!shouldTryNextModel(lastError)) return finish(lastError);
          if (launch()) return;
          if (active === 0) finish(null);
        },
      );
      if (hedgeTimer) clearTimeout(hedgeTimer);
      hedgeTimer = setTimeout(() => void launch(), GEMINI_HEDGE_MS);
      return true;
    };

    if (!launch()) finish(null);
  });

  if (raced && !(raced instanceof GeminiRequestError)) return { topics: raced.topics, model: raced.model, tried };
  if (raced instanceof GeminiRequestError) throw raced;

  const lastModel = tried[tried.length - 1];
  if (
    lastError &&
    lastModel &&
    isGeminiBusyError(lastError) &&
    !isQuotaError(lastError.debug) &&
    remaining() > geminiRetry.lastModelMs + 3_000
  ) {
    await geminiRetry.sleep(geminiRetry.lastModelMs);
    try {
      const topics = await requestGeminiOnce({ ...options, model: lastModel }, remaining);
      return { topics, model: lastModel, tried };
    } catch (error) {
      lastError = record(error, lastModel);
    }
  }

  throw lastError ?? new GeminiRequestError("timeout", geminiDebug({ reason: "deadline", model: options.model, tried, attempts }));
}

function generationConfig(model: string): Record<string, unknown> {
  // Gemini 3 系は temperature を 1.0 未満にするとループや劣化が起きると公式に書かれているので、既定のまま送らない。
  const base: Record<string, unknown> = { maxOutputTokens: 1024 };
  if (plainModels.has(model)) return base;
  const thinking = thinkingConfigFor(model);
  return {
    ...base,
    responseMimeType: "application/json",
    responseSchema: { type: "ARRAY", items: { type: "STRING" } },
    ...(thinking ? { thinkingConfig: thinking } : {}),
  };
}

type StreamChunk = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
  usageMetadata?: { thoughtsTokenCount?: number; candidatesTokenCount?: number };
  error?: unknown;
};

/** 1回の生成の結果。partial は時間切れ・十分な数で打ち切ったときに true。 */
export type GeminiText = {
  text: string;
  partial: boolean;
  firstChunkMs?: number;
  totalMs: number;
  finishReason?: string;
  thoughtsTokens?: number;
  outputTokens?: number;
};

function chunkText(chunk: StreamChunk): string {
  return (
    chunk.candidates?.[0]?.content?.parts
      ?.filter((part) => !part.thought)
      .map((part) => part.text ?? "")
      .join("") ?? ""
  );
}

/**
 * ストリーミングで生成する。必要な数のキーワードがそろった時点で打ち切り、
 * 時間切れでも途中まで届いた分は返す（遅い日やループしたときでも空で終わらないように）。
 */
async function generateGeminiText(
  options: GeminiOptions,
  remaining: Remaining,
  enough?: (text: string) => boolean,
  outer?: AbortSignal,
): Promise<GeminiText> {
  const controller = new AbortController();
  // 他のモデルが先に返ったときなど、呼び出し側から止められる
  if (outer?.aborted) controller.abort();
  else outer?.addEventListener("abort", () => controller.abort(), { once: true });
  const started = geminiRetry.now();
  let timedOut = false;
  let satisfied = false;
  const timer = setTimeout(
    () => {
      timedOut = true;
      controller.abort();
    },
    Math.max(1_000, Math.min(GEMINI_TIMEOUT_MS, remaining())),
  );
  const endpoint = `https://${GEMINI_HOST}/v1beta/models/${encodeURIComponent(options.model)}:streamGenerateContent?alt=sse`;
  const result: GeminiText = { text: "", partial: false, totalMs: 0 };
  let retryPlain = false;

  const absorb = (chunk: StreamChunk) => {
    if (chunk.error) {
      throw new GeminiRequestError(
        "http",
        geminiDebug({ reason: "http-200-error", httpStatus: 200, model: options.model, ...parseGoogleError(chunk) }),
      );
    }
    result.firstChunkMs ??= geminiRetry.now() - started;
    result.text += chunkText(chunk);
    result.finishReason = chunk.candidates?.[0]?.finishReason ?? result.finishReason;
    result.thoughtsTokens = chunk.usageMetadata?.thoughtsTokenCount ?? result.thoughtsTokens;
    result.outputTokens = chunk.usageMetadata?.candidatesTokenCount ?? result.outputTokens;
  };

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
        generationConfig: generationConfig(options.model),
      }),
    });
    if (!response.ok) {
      const google = parseGoogleError(await response.json().catch(() => null));
      // 思考・JSON 指定を知らないモデルなら、付けずにもう一度頼む
      if (response.status === 400 && google.googleStatus === "INVALID_ARGUMENT" && !plainModels.has(options.model)) {
        plainModels.add(options.model);
        retryPlain = true;
      } else {
        throw new GeminiRequestError(
          "http",
          geminiDebug({ reason: `http-${response.status}`, httpStatus: response.status, model: options.model, ...google }),
        );
      }
    } else if (response.body && typeof response.body.getReader === "function") {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";
        for (const event of events) {
          const data = event
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .join("");
          if (data) absorb(JSON.parse(data) as StreamChunk);
        }
        if (enough?.(result.text)) {
          satisfied = true;
          controller.abort();
          break;
        }
      }
    } else {
      // ストリームを返さない環境（テストのモックなど）は通常の JSON として読む
      const json = (await response.json()) as StreamChunk | StreamChunk[];
      for (const chunk of Array.isArray(json) ? json : [json]) absorb(chunk);
    }
  } catch (error) {
    if (error instanceof GeminiRequestError) throw error;
    if (!(satisfied || (timedOut && result.text.trim()))) {
      if (isAbortError(error, controller.signal.aborted)) {
        throw new GeminiRequestError("timeout", geminiDebug({ reason: "timeout", model: options.model }));
      }
      throw networkError(options.model, error);
    }
  } finally {
    clearTimeout(timer);
  }
  if (retryPlain) return generateGeminiText(options, remaining, enough, outer);
  result.partial = satisfied || timedOut;
  result.totalMs = geminiRetry.now() - started;
  return result;
}

function mergeParsedTopics(base: string[], extra: string[], count: number): string[] {
  const topics = [...base];
  for (const item of extra) {
    if (topics.length >= count) break;
    if (!topics.includes(item)) topics.push(item);
  }
  return topics;
}

async function requestGeminiOnce(options: GeminiOptions, remaining: Remaining, signal?: AbortSignal): Promise<string[]> {
  const enough = (existing: string[]) => (text: string) =>
    parseTopics(text, options.seed, existing).length >= options.count;
  const first = parseTopics(
    (await generateGeminiText(options, remaining, enough(options.existing), signal)).text,
    options.seed,
    options.existing,
  );
  if (first.length >= options.count || remaining() < 4_000) return first.slice(0, options.count);
  const seen = [...options.existing, ...first];
  try {
    const retry = parseTopics(
      (await generateGeminiText(options, remaining, enough(seen), signal)).text,
      options.seed,
      seen,
    );
    return mergeParsedTopics(first, retry, options.count);
  } catch {
    if (first.length > 0) return first;
    throw new GeminiRequestError("http", geminiDebug({ reason: "empty", model: options.model }));
  }
}

export type GeminiKeyCheck = {
  ok: boolean;
  httpStatus?: number;
  googleStatus?: string;
  googleMessage?: string;
  models: string[];
  /** 実際に短い生成をしてみた結果（キーが有効でも生成だけ失敗することがあるため） */
  generation?: {
    model: string;
    ok: boolean;
    reason?: string;
    googleStatus?: string;
    googleMessage?: string;
    topics?: string[];
    firstChunkMs?: number;
    totalMs?: number;
    finishReason?: string;
    thoughtsTokens?: number;
  };
};

/** 設定画面の「接続テスト」用。キーで使える Flash 系モデルを調べ、選んだモデルで短く生成してみる。 */
export async function checkGeminiKey(apiKey: string, model = DEFAULT_MODEL): Promise<GeminiKeyCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  let listed: GeminiKeyCheck;
  try {
    const response = await fetch(`https://${GEMINI_HOST}/v1beta/models?pageSize=200`, {
      signal: controller.signal,
      headers: { "x-goog-api-key": apiKey },
    });
    const json = (await response.json().catch(() => null)) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    } | null;
    if (!response.ok) {
      return { ok: false, httpStatus: response.status, ...parseGoogleError(json), models: [] };
    }
    const models = (json?.models ?? [])
      .filter((item) => item.supportedGenerationMethods?.includes("generateContent"))
      .map((item) => (item.name ?? "").replace(/^models\//, ""))
      .filter((name) => /flash/.test(name) && !/(tts|image|live|audio|transcribe|embedding)/.test(name));
    listed = { ok: true, httpStatus: response.status, models };
  } catch (error) {
    return {
      ok: false,
      googleMessage: isAbortError(error, controller.signal.aborted) ? "timeout" : "network",
      models: [],
    };
  } finally {
    clearTimeout(timer);
  }

  const target = resolveGeminiModel(model);
  const started = geminiRetry.now();
  const remaining: Remaining = () => GEMINI_TIMEOUT_MS - (geminiRetry.now() - started);
  try {
    const output = await generateGeminiText(
      { seed: "雑談", existing: [], apiKey, model: target, count: 3 },
      remaining,
      (text) => parseTopics(text, "雑談", []).length >= 3,
    );
    const topics = parseTopics(output.text, "雑談", []).slice(0, 3);
    return {
      ...listed,
      generation: {
        model: target,
        ok: topics.length > 0,
        reason: topics.length > 0 ? undefined : "empty",
        topics,
        firstChunkMs: output.firstChunkMs,
        totalMs: output.totalMs,
        finishReason: output.finishReason,
        thoughtsTokens: output.thoughtsTokens,
      },
    };
  } catch (error) {
    const debug = error instanceof GeminiRequestError ? error.debug : undefined;
    return {
      ...listed,
      generation: {
        model: target,
        ok: false,
        reason: debug?.reason ?? "network",
        googleStatus: debug?.googleStatus,
        googleMessage: debug?.googleMessage,
        totalMs: geminiRetry.now() - started,
      },
    };
  }
}
