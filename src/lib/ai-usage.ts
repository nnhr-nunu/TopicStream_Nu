import type { GenerateResult } from "@/lib/types";

/**
 * この端末から AI（Gemini）を使った量の記録。設定画面の下に「今日の利用状況」として出す（開発中の目安）。
 * Gemini API は残りの枠を返さないので、ここで分かるのは「使った量」と「失敗の理由」だけ。
 * 無料枠の1日の回数は太平洋時間の 0 時に戻るので、日付も太平洋時間で区切る。
 */
const KEY = "topicstream-nu:ai-usage";

export type AiUsageDay = {
  /** 太平洋時間の日付（YYYY-MM-DD） */
  day: string;
  /** 広げる操作で AI に頼んだ回数 */
  requests: number;
  /** Gemini へ実際に送ったリクエストの数（モデルの切り替え・再試行を含む） */
  calls: number;
  tokens: number;
  /** AI の語が取れずオフライン候補になった回数 */
  fallbacks: number;
  /** 失敗の理由ごとの回数（例: "http-503 UNAVAILABLE"） */
  failures: Record<string, number>;
  last?: { at: number; reason: string; model: string; attempts?: string[] };
};

const listeners = new Set<() => void>();

export function pacificDay(now = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function emptyDay(day: string): AiUsageDay {
  return { day, requests: 0, calls: 0, tokens: 0, fallbacks: 0, failures: {} };
}

export function loadAiUsage(now = Date.now()): AiUsageDay {
  const day = pacificDay(now);
  if (typeof window === "undefined") return emptyDay(day);
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as AiUsageDay | null;
    return parsed && parsed.day === day ? { ...emptyDay(day), ...parsed } : emptyDay(day);
  } catch {
    return emptyDay(day);
  }
}

/** 失敗の理由を短い1語にする（オフライン生成が普通の動きのキー無し版は数えない） */
export function failureReason(result: GenerateResult): string | null {
  const debug = result.debug;
  if (!debug || debug.reason === "missing-key") return null;
  return debug.googleStatus ? `${debug.reason} ${debug.googleStatus}` : debug.reason;
}

export function recordAiUsage(result: GenerateResult, now = Date.now()) {
  if (typeof window === "undefined") return;
  const reason = result.source === "mock" ? failureReason(result) : null;
  // キーが無い・サーバーが無い公開版（AI を呼んでいない）は記録しない
  if (!result.usage && !reason) return;
  const current = loadAiUsage(now);
  const next: AiUsageDay = {
    ...current,
    requests: current.requests + 1,
    calls: current.calls + (result.usage?.calls ?? 0),
    tokens: current.tokens + (result.usage?.tokens ?? 0),
    fallbacks: current.fallbacks + (reason ? 1 : 0),
    failures: reason ? { ...current.failures, [reason]: (current.failures[reason] ?? 0) + 1 } : current.failures,
    last:
      reason && result.debug
        ? { at: now, reason, model: result.debug.model, attempts: result.debug.attempts }
        : current.last,
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    return;
  }
  for (const listener of listeners) listener();
}

export function subscribeAiUsage(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
