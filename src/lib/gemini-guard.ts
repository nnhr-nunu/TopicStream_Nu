import { DEFAULT_MODEL, GEMINI_FALLBACK_MODELS } from "@/lib/constants";

/**
 * Gemini を呼ぶ前の交通整理（サーバー専用・インスタンスごとのメモリ）。
 * 開発者の無料枠を、少数の人や連打で使い切らないための仕組み。
 * Vercel ではインスタンスが複数になりうるので厳密な全体制限ではない（目安として効けばよい）。
 */

export const GUARD_LIMITS = {
  /** 1人（IP）あたり、1分間に AI で広げられる回数 */
  perMinute: 8,
  /** 1人（IP）あたり、1時間に AI で広げられる回数 */
  perHour: 60,
  /** 1つのサーバーで同時に Gemini を呼んでよい数 */
  concurrent: 8,
  /** 書き出し（盤面が空）の結果を使い回す時間 */
  cacheMs: 30 * 60_000,
  cacheEntries: 200,
};

/** 自分のキーを入れた人の上限。開発者の枠は減らないので広めにする（サーバーを連打で使われないための歯止めだけ） */
export const OWN_KEY_LIMITS: typeof GUARD_LIMITS = { ...GUARD_LIMITS, perMinute: 30, perHour: 600 };

type Clock = () => number;

export type GuardDecision = { ok: true; release: () => void } | { ok: false; reason: "rate" | "busy"; retryInMs: number };

export function createGeminiGuard(now: Clock = Date.now, limits: typeof GUARD_LIMITS = GUARD_LIMITS) {
  const history = new Map<string, number[]>();
  let active = 0;
  const cache = new Map<string, { topics: string[]; at: number }>();

  function acquire(clientKey: string): GuardDecision {
    const t = now();
    const recent = (history.get(clientKey) ?? []).filter((at) => t - at < 60 * 60_000);
    const lastMinute = recent.filter((at) => t - at < 60_000);
    if (lastMinute.length >= limits.perMinute) {
      return { ok: false, reason: "rate", retryInMs: 60_000 - (t - lastMinute[0]!) };
    }
    if (recent.length >= limits.perHour) {
      return { ok: false, reason: "rate", retryInMs: 60 * 60_000 - (t - recent[0]!) };
    }
    if (active >= limits.concurrent) {
      return { ok: false, reason: "busy", retryInMs: 3_000 };
    }
    recent.push(t);
    history.set(clientKey, recent);
    // 使われなくなった人の記録を溜めない
    if (history.size > 5_000) {
      for (const [key, times] of history) {
        if (times.every((at) => t - at > 60 * 60_000)) history.delete(key);
      }
    }
    active += 1;
    let released = false;
    return {
      ok: true,
      release: () => {
        if (released) return;
        released = true;
        active -= 1;
      },
    };
  }

  /** 書き出し（既存の語がほぼ無い）のときだけ使い回す。以降の展開は盤面ごとに違うので保存しない。 */
  function cacheKey(seed: string, existing: string[], count: number, mode = "chat"): string | null {
    if (existing.length > 1) return null;
    return `${mode}|${seed.trim().toLowerCase()}|${count}`;
  }

  function readCache(key: string | null): string[] | null {
    if (!key) return null;
    const hit = cache.get(key);
    if (!hit) return null;
    if (now() - hit.at > limits.cacheMs) {
      cache.delete(key);
      return null;
    }
    return hit.topics;
  }

  function writeCache(key: string | null, topics: string[]) {
    if (!key || topics.length === 0) return;
    cache.set(key, { topics, at: now() });
    if (cache.size > limits.cacheEntries) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
  }

  return { acquire, cacheKey, readCache, writeCache, activeCount: () => active };
}

/**
 * 使うモデル。サーバーのキーで呼ぶときは決めたモデルだけ（高いモデルや知らない名前で枠を使わせない）。
 * 利用者が自分のキーを入れたときは、形の合う名前なら何でもよい
 */
export function allowedModel(requested: unknown, ownKey: boolean): string {
  const name = typeof requested === "string" ? requested.trim() : "";
  if (!name) return DEFAULT_MODEL;
  if (ownKey) return /^[\w.-]{1,64}$/.test(name) ? name : DEFAULT_MODEL;
  return (GEMINI_FALLBACK_MODELS as readonly string[]).includes(name) ? name : DEFAULT_MODEL;
}

/** Vercel などのプロキシ越しでも、同じ人をおおよそ同じキーにまとめる */
export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
