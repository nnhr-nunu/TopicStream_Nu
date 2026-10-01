import { DEFAULT_MODEL, GEMINI_FALLBACK_MODELS, RETIRED_GEMINI_MODELS } from "@/lib/constants";

/*
 * 呼び出しの時間の上限・待ちの設定・モデルの選び方（フォールバックと混雑の後回し）・思考の設定。
 * geminiRetry とモデルの後回しの記録は、モジュールの中で 1 つだけ持つ（テストが geminiRetry を差し替える）。
 */

/** 1回の呼び出しの上限。ストリーミングなので、時間切れでも届いた分は使う。 */
export const GEMINI_TIMEOUT_MS = 20_000;
/** 1巡目: 最初の文字がこの時間内に来ないモデルは諦めて次へ（混んでいるモデルで待ち続けない）。 */
export const GEMINI_FIRST_CHUNK_MS = 6_000;
/** 2巡目（全部のモデルが時間切れ・混雑だったとき）は、1つのモデルを長めに待つ */
export const GEMINI_PATIENT_FIRST_CHUNK_MS = 15_000;
/** モデルを替えて試す全体の上限。API route の maxDuration（60秒）より短くする。 */
export const GEMINI_DEADLINE_MS = 50_000;

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

/** 混んでいた（503・時間切れ・一時的な 429）モデルを後回しにする時間 */
export const MODEL_COOLDOWN_MS = 120_000;
/** モデル → 後回しをやめる時刻。サーバーの同じインスタンスの中だけで覚える（次の人も同じモデルで待たされないように） */
const modelCooldown = new Map<string, number>();

export function clearModelCooldown() {
  modelCooldown.clear();
}

/** 混んでいたモデルを後回しにする（記録の中身は、このモジュールの外から触らない） */
export function coolDownModel(model: string) {
  modelCooldown.set(model, geminiRetry.now() + MODEL_COOLDOWN_MS);
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
