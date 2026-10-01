import { DEFAULT_MODEL, GEMINI_HOST } from "@/lib/constants";
import {
  GeminiRequestError,
  geminiDebug,
  describeAttempt,
  isAbortError,
  isBillingError,
  isGeminiBusyError,
  isQuotaError,
  networkError,
  parseGoogleError,
  shouldRetrySameModel,
  shouldTryNextModel,
} from "@/lib/gemini-errors";
import {
  coolDownModel,
  fallbackModels,
  GEMINI_DEADLINE_MS,
  GEMINI_FIRST_CHUNK_MS,
  GEMINI_PATIENT_FIRST_CHUNK_MS,
  GEMINI_TIMEOUT_MS,
  geminiRetry,
  orderByCooldown,
  resolveGeminiModel,
} from "@/lib/gemini-models";
import { generateGeminiText, type GeminiOptions, type Remaining } from "@/lib/gemini-stream";
import { closedPart, mergeParsedTopics, parseTopics } from "@/lib/topic-parse";
import type { GeminiDebug } from "@/lib/types";

/*
 * Gemini へモデルを替えながら頼む側（サーバー専用）。切り出した中身は、利用側が今までどおり gemini-core から import できるよう再エクスポートする。
 * - topic-parse: 返答の読み取り（クライアントからも使う純粋な処理）
 * - gemini-errors: 失敗のエラーと判定・利用者に見せる文
 * - gemini-models: 時間の上限・待ち・モデルの選び方
 * - gemini-prompt: AI への指示の組み立て
 * - gemini-stream: 1 回のストリーミング生成
 */
export type { GeminiDebug };
export { anchorInstruction, buildPrompt } from "@/lib/gemini-prompt";
export { closedPart, isJunkTopic, labelLimit, padTopics, parseTopics } from "@/lib/topic-parse";
export type { GeminiWaitStage } from "@/lib/topic-parse";
export {
  GeminiRequestError,
  geminiDebug,
  geminiFailureWarning,
  geminiUserNotice,
  isBillingError,
  isGeminiBusyError,
  isQuotaError,
  parseGoogleError,
  shouldTryNextModel,
} from "@/lib/gemini-errors";
export type { GeminiNoticeKind } from "@/lib/gemini-errors";
export {
  clearModelCooldown,
  fallbackModels,
  GEMINI_DEADLINE_MS,
  GEMINI_FIRST_CHUNK_MS,
  GEMINI_PATIENT_FIRST_CHUNK_MS,
  GEMINI_TIMEOUT_MS,
  geminiRetry,
  MODEL_COOLDOWN_MS,
  orderByCooldown,
  resolveGeminiModel,
  thinkingConfigFor,
} from "@/lib/gemini-models";
export type { GeminiText } from "@/lib/gemini-stream";

function noteModelBusy(error: GeminiRequestError, model: string) {
  if (isQuotaError(error.debug) || isBillingError(error.debug)) return;
  if (error.kind === "timeout" || isGeminiBusyError(error)) coolDownModel(model);
}

async function requestGeminiWithSameModelRetry(options: GeminiOptions, remaining: Remaining): Promise<string[]> {
  try {
    return await requestGeminiOnce(options, remaining);
  } catch (error) {
    const first = error instanceof GeminiRequestError ? error : networkError(options.model, error);
    if (!shouldRetrySameModel(first) || remaining() < geminiRetry.sameModelMs + 3_000) throw first;
    await geminiRetry.sleep(geminiRetry.sameModelMs);
    return requestGeminiOnce(options, remaining);
  }
}

/**
 * モデルを1つずつ試す（同時に複数は投げない＝枠を倍使わない）。
 * 最初の文字が GEMINI_FIRST_CHUNK_MS 以内に来なければ、そのモデルは諦めて次へ進む。
 * 途中まで出た語は取っておき、次のモデルには「それ以外」を頼む。
 */
export async function requestGemini(
  options: GeminiOptions,
): Promise<{ topics: string[]; model: string; tried: string[] }> {
  const started = geminiRetry.now();
  const deadline = options.deadlineMs ?? GEMINI_DEADLINE_MS;
  const remaining: Remaining = () => deadline - (geminiRetry.now() - started);
  const tried: string[] = [];
  const attempts: string[] = [];
  const models = options.ownKey ? fallbackModels(options.model) : orderByCooldown(fallbackModels(options.model));
  const collected: string[] = [];
  const minimum = Math.min(options.count, Math.max(1, options.minimum ?? options.count));
  let lastError: GeminiRequestError | undefined;
  /** 途中のモデルで「利用枠が無い」と言われたら覚えておく（最後のモデルの 503 より、こちらが本当の原因） */
  let quotaError: GeminiRequestError | undefined;

  const emit = (label: string) => {
    if (collected.includes(label) || collected.length >= options.count) return;
    collected.push(label);
    options.onTopic?.(label);
  };

  const record = (error: unknown, model: string) => {
    const failed = error instanceof GeminiRequestError ? error : networkError(model, error);
    attempts.push(describeAttempt(failed));
    failed.debug.tried = [...tried];
    failed.debug.attempts = [...attempts];
    if (isQuotaError(failed.debug)) quotaError ??= failed;
    if (!options.ownKey) noteModelBusy(failed, model);
    return failed;
  };

  const runModel = async (model: string, firstChunkMs: number) => {
    const need = options.count - collected.length;
    const topics = await requestGeminiWithSameModelRetry(
      {
        ...options,
        model,
        firstChunkMs,
        count: need,
        minimum: Math.max(1, minimum - collected.length),
        existing: [...options.existing, ...collected],
        onTopic: emit,
      },
      remaining,
    );
    for (const label of topics) emit(label);
  };

  // 1巡目は最初の文字が遅いモデルを早めに見切って次へ。全部が時間切れ・混雑なら、少し置いて
  // 2巡目は同じモデルを長めに待つ（多少待っても、AI の語が出る見込みを上げる）
  /** 2巡目で試し直す意味があるモデル（時間切れ・混雑。枠切れ・404 は待っても直らない） */
  const retryable: string[] = [];
  let lastModel: string | undefined;
  for (const [round, patience] of [GEMINI_FIRST_CHUNK_MS, GEMINI_PATIENT_FIRST_CHUNK_MS].entries()) {
    const queue = round === 0 ? models : [...retryable];
    if (queue.length === 0 || collected.length >= minimum) break;
    if (round > 0) {
      if (remaining() < geminiRetry.nextRoundMs + 5_000) break;
      options.onStage?.("retry");
      await geminiRetry.sleep(geminiRetry.nextRoundMs);
    }
    for (const model of queue) {
      if (remaining() < 3_000 || collected.length >= minimum) break;
      if (round === 0 && lastError) options.onStage?.("switch");
      if (!tried.includes(model)) tried.push(model);
      lastModel = model;
      try {
        await runModel(model, patience);
        // 200 で答えが空（安全フィルタ・出力の上限など）: 定型の候補だけで埋める前に、次のモデルにも聞く
        // （一部でも取れていれば、足りない分は呼び出し側で埋める）
        if (collected.length === 0 && remaining() >= 3_000) throw new GeminiRequestError("http", geminiDebug({ reason: "empty", model }));
        return { topics: [...collected], model, tried };
      } catch (error) {
        lastError = record(error, model);
        if (collected.length > 0 && !shouldTryNextModel(lastError)) break;
        if (!shouldTryNextModel(lastError)) throw lastError;
        const again = lastError.kind === "timeout" || (isGeminiBusyError(lastError) && !isQuotaError(lastError.debug));
        if (round === 0 && again) retryable.push(model);
      }
    }
  }

  // 一部でも AI の語が取れていれば成功として返す（足りない分は呼び出し側で埋める）
  if (collected.length > 0) return { topics: [...collected], model: lastModel ?? options.model, tried };
  if (quotaError) {
    quotaError.debug.tried = [...tried];
    quotaError.debug.attempts = [...attempts];
    throw quotaError;
  }
  throw lastError ?? new GeminiRequestError("timeout", geminiDebug({ reason: "deadline", model: options.model, tried, attempts }));
}

async function requestGeminiOnce(options: GeminiOptions, remaining: Remaining): Promise<string[]> {
  // 届いた分をその都度パースし、新しい語は onTopic で先に知らせる。必要数そろったら打ち切る。
  const watch = (existing: string[]) => (text: string) => {
    const topics = parseTopics(closedPart(text), options.seed, existing, options.detail, options.mode);
    // 最後の1語は書きかけかもしれないので、閉じた語だけ知らせる（JSON 配列の途中は quoted で拾える）
    for (const label of topics.slice(0, options.count)) options.onTopic?.(label);
    return topics.length >= options.count;
  };
  const first = parseTopics(
    (await generateGeminiText(options, remaining, watch(options.existing))).text,
    options.seed,
    options.existing,
    options.detail,
    options.mode,
  );
  // 予備（minimum を超える分）が足りないだけなら呼び直さない（呼ぶ回数・枠の節約）
  if (first.length >= (options.minimum ?? options.count) || remaining() < 4_000) return first.slice(0, options.count);
  const seen = [...options.existing, ...first];
  let merged = first;
  try {
    // 1 回目で出た語も「重ならないように」に入れる（入れないと同じ語をまた返し、全部落ちて 1 回分を無駄にする）
    const retry = parseTopics(
      (await generateGeminiText({ ...options, existing: seen, count: options.count - first.length }, remaining, watch(seen))).text,
      options.seed,
      seen,
      options.detail,
      options.mode,
    );
    merged = mergeParsedTopics(first, retry, options.count);
  } catch {
    /* 2 回目が失敗しても、1 回目の語があれば使う */
  }
  if (merged.length === 0) throw new GeminiRequestError("http", geminiDebug({ reason: "empty", model: options.model }));
  return merged;
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
