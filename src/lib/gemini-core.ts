import {
  DETAIL_LABEL_MAX,
  DEFAULT_MODEL,
  GEMINI_FALLBACK_MODELS,
  GEMINI_HOST,
  LABEL_FIT_MAX,
  RETIRED_GEMINI_MODELS,
} from "@/lib/constants";
import { redactSecret } from "@/lib/env-secret";
import { mixOriginNote } from "@/lib/combine";
import { buildDetailPrompt } from "@/lib/detail-modes";
import { diversifyLabels, isTruncatedLabel } from "@/lib/label-quality";
import { buildModePrompt } from "@/lib/modes";
import type { BoardMode, GeminiDebug } from "@/lib/types";

export type { GeminiDebug };

export function buildPrompt(
  seed: string,
  existing: string[],
  count: number,
  context: string[] = [],
  mode: BoardMode = "chat",
  detail = false,
  /** 掛け合わせのカードを広げるとき、持ってきた側のカードの祖先（近い順） */
  mixFrom: string[] = [],
): string {
  const banned = existing.slice(0, 24).join(" / ") || "なし";
  // 祖先は近い順で届くので、話の流れとして読めるよう遠い方から並べる
  const flow = context.length
    ? `
このお題は「${[...context].reverse().join(" → ")} → ${seed}」という話の流れで出てきました。流れから外れない切り口にしてください。
${anchorInstruction(mode, seed, context)}${mixOriginNote(seed, context[1], mixFrom[0])}`
    : "";
  return detail ? buildDetailPrompt(mode, seed, count, flow, banned, context) : buildModePrompt(mode, seed, count, flow, banned);
}

/**
 * 深く広げたときに、最初のお題（中心）から話がズレないようにする指示。
 * 雑談は話が広がるのが楽しいので付けない。お悩み相談などの目的があるモードは、中心の役に立つ切り口に寄せる。
 */
export function anchorInstruction(mode: BoardMode, seed: string, context: string[]): string {
  const root = context[context.length - 1];
  if (mode === "chat" || context.length < 2 || !root) return "";
  return `このボードの中心のお題は「${root}」です。「${seed}」を掘り下げつつ、どれも中心のお題「${root}」の役に立つ・つながる切り口にしてください。中心から離れた一般論にはしないでください。
`;
}

/** 語の長さの上限。「具体的にする」の答えは文なので長め */
export function labelLimit(detail = false): number {
  return detail ? DETAIL_LABEL_MAX : LABEL_FIT_MAX;
}

/**
 * 上限に収まる語だけ通す。長すぎる語は「…」で切らずに捨てる
 * （切った語は、カードでも図鑑でも中途半端で、図鑑ではそれが次のお題にまでなっていた）。足りない分は他の候補で埋める。
 * 「具体的にする」の答え（文）は捨てると中身が無くなるので、上限で切る（図鑑には記録しない）
 */
function fit(label: string, max: number, sentence: boolean): string {
  const trimmed = label.trim();
  if (sentence) return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
  return trimmed.length <= max && !isTruncatedLabel(trimmed) ? trimmed : "";
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

function extractQuoted(raw: string, sentences = false): string[] {
  const out: string[] = [];
  const closed = /"((?:\\.|[^"\\])*)"/g;
  let match: RegExpExecArray | null;
  while ((match = closed.exec(raw))) {
    out.push(match[1].replace(/\\"/g, '"').replace(/\\n/g, " "));
  }
  const jp = /[「『]([^」』]+)[」』]/g;
  // 文の中の「」は語の区切りではないので、答え（文）のときは拾わない
  while (!sentences && (match = jp.exec(raw))) {
    out.push(match[1]);
  }
  if (out.length > 0) return out;
  const unclosed = raw.match(/"([^"\n\]]+)/);
  if (unclosed?.[1]) return [unclosed[1]];
  return [];
}

/** 番号・記号・引用符を外す。文（sentences）のときは、文頭・文末の「」は中身の一部なので残す */
function stripDecorations(value: string, sentences = false): string {
  let text = value.replace(/\s+/g, " ").trim();
  text = text.replace(/^[0-9]+[A-Ia-i]\s*/, "");
  text = text.replace(/^[0-9]+[\.\):、]\s*/, "");
  text = text.replace(/^[-*・\u30fb]\s*/, "");
  const head = sentences ? /^[\s\[\]\{\}"'`]+/ : /^[\s\[\]\{\}「『"'`]+/;
  const tail = sentences ? /[\s\[\]\{\}"'`,;]+$/ : /[\s\[\]\{\}」』"'`,;]+$/;
  for (let i = 0; i < 4; i += 1) {
    const next = text.replace(head, "").replace(tail, "").trim();
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

export function parseTopics(raw: string, seed: string, existing: string[], detail = false, mode: BoardMode = "chat"): string[] {
  const text = unwrapFences(raw);
  const fromJson = tryParseJsonArray(text);
  const quoted = extractQuoted(text, detail);
  const values: unknown[] =
    fromJson && fromJson.length > 0
      ? fromJson
      : quoted.length > 0
        ? quoted
        : text
            .split(detail ? /\n/ : /[\n,、]/)
            .map((part) => part.trim())
            .filter(Boolean);

  const banned = new Set([seed.trim(), ...existing.map((item) => item.trim())]);
  const topics: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const label = fit(stripDecorations(value, detail), labelLimit(detail), detail);
    if (!label || isJunkTopic(label) || banned.has(label) || topics.includes(label)) continue;
    topics.push(label);
  }
  // 答え（文）は書き出しがそろうのがふつうなので、語のときだけ整える。雑談以外は「毎朝10分〇〇」のように型がそろう語も多いので、
  // 同じ書き出しは数えず、ほぼ同じ語だけ落とす
  return detail ? topics : diversifyLabels(topics, mode === "chat" ? undefined : Infinity);
}

export function padTopics(parsed: string[], fallback: string[], count: number, seed: string, detail = false): string[] {
  const out = [...parsed];
  const banned = new Set([seed.trim(), ...out]);
  for (const item of fallback) {
    if (out.length >= count) break;
    const label = fit(stripDecorations(item, detail), labelLimit(detail), detail);
    if (!label || isJunkTopic(label) || banned.has(label)) continue;
    out.push(label);
    banned.add(label);
  }
  return out.slice(0, count);
}

/** 1回の呼び出しの上限。ストリーミングなので、時間切れでも届いた分は使う。 */
export const GEMINI_TIMEOUT_MS = 20_000;
/** 1巡目: 最初の文字がこの時間内に来ないモデルは諦めて次へ（混んでいるモデルで待ち続けない）。 */
export const GEMINI_FIRST_CHUNK_MS = 6_000;
/** 2巡目（全部のモデルが時間切れ・混雑だったとき）は、1つのモデルを長めに待つ */
export const GEMINI_PATIENT_FIRST_CHUNK_MS = 15_000;
/** モデルを替えて試す全体の上限。API route の maxDuration（60秒）より短くする。 */
export const GEMINI_DEADLINE_MS = 50_000;

/** 待ちが長引いた理由（switch: 混んでいて別のモデルに聞き直す、retry: 全部混んでいて少し置いて2巡目） */
export type GeminiWaitStage = "switch" | "retry";

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

/** テストで待ちを潰す。本番は短いバックオフと、全部だめだったときに2巡目へ入る前の 1.5 秒待ち。 */
export const geminiRetry = {
  sameModelMs: 800,
  nextRoundMs: 1_500,
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

function isUnavailable(error: GeminiRequestError): boolean {
  return error.debug.httpStatus === 503 || error.debug.googleStatus === "UNAVAILABLE";
}

function shouldRetrySameModel(error: GeminiRequestError): boolean {
  // 割り当てが無い 429 は待っても通らないので、すぐ次のモデルへ。
  // 503（Google 側でそのモデルが混んでいる）は 1 秒待っても空かないことが多いので、待たずに別のモデルへ
  return isGeminiBusyError(error) && !isQuotaError(error.debug) && !isUnavailable(error);
}

/** 混んでいた（503・時間切れ・一時的な 429）モデルを後回しにする時間 */
export const MODEL_COOLDOWN_MS = 120_000;
/** モデル → 後回しをやめる時刻。サーバーの同じインスタンスの中だけで覚える（次の人も同じモデルで待たされないように） */
const modelCooldown = new Map<string, number>();

export function clearModelCooldown() {
  modelCooldown.clear();
}

function noteModelBusy(error: GeminiRequestError, model: string) {
  if (isQuotaError(error.debug) || isBillingError(error.debug)) return;
  if (error.kind === "timeout" || isGeminiBusyError(error)) modelCooldown.set(model, geminiRetry.now() + MODEL_COOLDOWN_MS);
}

/** 最近混んでいたモデルを後ろへ回す（順番はそれ以外そのまま。全部混んでいても試す順が変わるだけ） */
export function orderByCooldown(models: string[]): string[] {
  const now = geminiRetry.now();
  const cooling = (model: string) => (modelCooldown.get(model) ?? 0) > now;
  return [...models.filter((model) => !cooling(model)), ...models.filter(cooling)];
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
  /** 最低これだけそろえばよい数（省くと count）。count との差は予備なので、足りなくても予備のためだけに呼び直さない */
  minimum?: number;
  /** 広げるカードの祖先（近い順）。汎用の切り口を広げるときに、何の話なのかを伝える */
  context?: string[];
  /** ボードの用途（雑談・お悩み相談など）。指示の中身が変わる */
  mode?: BoardMode;
  /** 「具体的にする」: 切り口ではなく、対応策・答え・話し方の例を短い文で出してもらう */
  detail?: boolean;
  /** 新しいキーワードが1つ読めるたびに呼ぶ（画面に1つずつ出すため）。モデルを替えても同じ語は2度呼ばない。 */
  onTopic?: (label: string) => void;
  /** 待ちが長引いたときに呼ぶ（switch: 別のモデルに聞き直す、retry: 2巡目に入る）。画面で待っている理由を見せる */
  onStage?: (stage: GeminiWaitStage) => void;
  /** Gemini へ1回リクエストを送るたびに呼ぶ（届いた usageMetadata の合計トークン。失敗・途中打ち切りは分かった分だけ） */
  onCall?: (tokens: number) => void;
  /** 掛け合わせのカードを広げるとき、持ってきた側のカードの祖先（近い順） */
  mixFrom?: string[];
  /** 全体の上限（省くと GEMINI_DEADLINE_MS）。まとめて何度も呼ぶ図鑑育てなどで短くする */
  deadlineMs?: number;
  /** 最初の文字を待つ時間（省くと GEMINI_FIRST_CHUNK_MS）。requestGemini が巡目ごとに決める */
  firstChunkMs?: number;
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
  const models = orderByCooldown(fallbackModels(options.model));
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
    noteModelBusy(failed, model);
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

function generationConfig(model: string, detail = false): Record<string, unknown> {
  // Gemini 3 系は temperature を 1.0 未満にするとループや劣化が起きると公式に書かれているので、既定のまま送らない。
  // 答え（文）は長いので、途中で切れないよう多めに
  const base: Record<string, unknown> = { maxOutputTokens: detail ? 2048 : 1024 };
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
  usageMetadata?: { thoughtsTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
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
  totalTokens?: number;
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
 * 最初の文字が GEMINI_FIRST_CHUNK_MS 以内に来ないときは時間切れとして次のモデルへ回す。
 */
async function generateGeminiText(
  options: GeminiOptions,
  remaining: Remaining,
  progress?: (text: string) => boolean,
): Promise<GeminiText> {
  const controller = new AbortController();
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
  const firstChunkTimer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.firstChunkMs ?? GEMINI_FIRST_CHUNK_MS);
  const endpoint = `https://${GEMINI_HOST}/v1beta/models/${encodeURIComponent(options.model)}:streamGenerateContent?alt=sse`;
  const result: GeminiText = { text: "", partial: false, totalMs: 0 };
  let retryPlain = false;
  let sent = false;

  const absorb = (chunk: StreamChunk) => {
    if (chunk.error) {
      throw new GeminiRequestError(
        "http",
        geminiDebug({ reason: "http-200-error", httpStatus: 200, model: options.model, ...parseGoogleError(chunk) }),
      );
    }
    if (result.firstChunkMs === undefined) {
      result.firstChunkMs = geminiRetry.now() - started;
      clearTimeout(firstChunkTimer);
    }
    result.text += chunkText(chunk);
    result.finishReason = chunk.candidates?.[0]?.finishReason ?? result.finishReason;
    result.thoughtsTokens = chunk.usageMetadata?.thoughtsTokenCount ?? result.thoughtsTokens;
    result.outputTokens = chunk.usageMetadata?.candidatesTokenCount ?? result.outputTokens;
    result.totalTokens = chunk.usageMetadata?.totalTokenCount ?? result.totalTokens;
  };

  try {
    sent = true;
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": options.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(options.seed, options.existing, options.count, options.context, options.mode, options.detail, options.mixFrom) }] }],
        generationConfig: generationConfig(options.model, options.detail),
      }),
    });
    if (!response.ok) {
      clearTimeout(firstChunkTimer);
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
        if (progress?.(result.text)) {
          satisfied = true;
          controller.abort();
          break;
        }
      }
    } else {
      // ストリームを返さない環境（テストのモックなど）は通常の JSON として読む
      const json = (await response.json()) as StreamChunk | StreamChunk[];
      for (const chunk of Array.isArray(json) ? json : [json]) absorb(chunk);
      progress?.(result.text);
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
    clearTimeout(firstChunkTimer);
    if (sent) options.onCall?.(result.totalTokens ?? 0);
  }
  if (retryPlain) return generateGeminiText(options, remaining, progress);
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

/** ストリームの途中で、書きかけの文字列（閉じていない "…）を切り落とす。 */
export function closedPart(text: string): string {
  let inString = false;
  let lastClosed = -1;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "\\") {
      i += 1;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      if (!inString) lastClosed = i;
    }
  }
  return inString ? text.slice(0, lastClosed + 1) : text;
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
  try {
    const retry = parseTopics(
      (await generateGeminiText({ ...options, count: options.count - first.length }, remaining, watch(seen))).text,
      options.seed,
      seen,
      options.detail,
      options.mode,
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
