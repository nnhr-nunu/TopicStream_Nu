import { GEMINI_HOST } from "@/lib/constants";
import { redactSecret } from "@/lib/env-secret";
import { GEMINI_DEADLINE_MS, GEMINI_TIMEOUT_MS } from "@/lib/gemini-models";
import type { GeminiDebug } from "@/lib/types";

/*
 * Gemini への呼び出しの失敗を表すエラーと、その判定（混雑・枠切れ・請求・次のモデルへ回すか）、
 * 利用者・ログに見せる文。リクエストを送る側は gemini-core.ts。
 */

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

export function isAbortError(error: unknown, aborted: boolean): boolean {
  if (aborted) return true;
  let current: unknown = error;
  for (let i = 0; i < 5 && current && typeof current === "object"; i += 1) {
    const name = (current as { name?: string }).name;
    if (name === "AbortError" || name === "TimeoutError") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export function clipGoogleText(raw: string): string {
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

/** key = 利用者が自分で入れたキーを Google が受け付けなかった */
export type GeminiNoticeKind = "quota" | "busy" | "slow" | "unavailable" | "key";

/**
 * 利用者に見せる短いお知らせ。モデル名や試した順番などの技術的な中身は出さない
 * （それは debug とサーバーログに残す）。
 * ownKey: 利用者が自分で入れたキーで呼んだとき。枠切れ・キーの誤りは本人が直せるので、そう分かる文にする
 */
export function geminiUserNotice(error: unknown, ownKey = false): { kind: GeminiNoticeKind; message: string } {
  const debug = error instanceof GeminiRequestError ? error.debug : undefined;
  const reason = debug?.reason ?? "network";
  if (isQuotaError(debug)) {
    return {
      kind: "quota",
      message: ownKey
        ? "自分の AI キーの利用上限に達しました。今回はオフラインの候補で広げました（時間を置くと戻ります）。"
        : "みんなで分け合っている AI の利用上限に達しました。設定の「自分の AI キー」に無料のキーを入れると、自分の枠で続けられます。今回はオフラインの候補で広げました。",
    };
  }
  if (ownKey && (debug?.httpStatus === 400 || debug?.httpStatus === 401 || debug?.httpStatus === 403)) {
    return {
      kind: "key",
      message: "自分の AI キーが使えませんでした。設定の「自分の AI キー」で接続テストをしてみてください。今回はオフラインの候補で広げました。",
    };
  }
  if (reason === "http-429" || reason === "http-503" || debug?.googleStatus === "UNAVAILABLE" || debug?.googleStatus === "RESOURCE_EXHAUSTED") {
    return { kind: "busy", message: "AI が混み合っているので、今回はオフラインの候補で広げました。" };
  }
  if (reason === "timeout" || reason === "deadline") {
    return { kind: "slow", message: "AI の応答が遅いので、今回はオフラインの候補で広げました。" };
  }
  return { kind: "unavailable", message: "AI を使えなかったので、今回はオフラインの候補で広げました。" };
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
  // 答えが空（安全フィルタ・出力の上限）・Google 側の一時的な故障は、別のモデルなら通ることがある
  if (error.debug.reason === "empty") return true;
  if (status === 500 || status === 502 || status === 504 || google === "INTERNAL" || google === "DEADLINE_EXCEEDED") return true;
  return isGeminiBusyError(error);
}

function isUnavailable(error: GeminiRequestError): boolean {
  return error.debug.httpStatus === 503 || error.debug.googleStatus === "UNAVAILABLE";
}

export function shouldRetrySameModel(error: GeminiRequestError): boolean {
  // 割り当てが無い 429 は待っても通らないので、すぐ次のモデルへ。
  // 503（Google 側でそのモデルが混んでいる）は 1 秒待っても空かないことが多いので、待たずに別のモデルへ
  return isGeminiBusyError(error) && !isQuotaError(error.debug) && !isUnavailable(error);
}

export function describeAttempt(error: GeminiRequestError): string {
  const google = error.debug.googleStatus ? ` ${error.debug.googleStatus}` : "";
  return `${error.debug.model}: ${error.debug.reason}${google}`;
}

export function networkError(model: string, error: unknown): GeminiRequestError {
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
