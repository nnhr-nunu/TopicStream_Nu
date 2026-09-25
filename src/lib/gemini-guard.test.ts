import { describe, expect, it } from "vitest";

import { clientKeyFromHeaders, createGeminiGuard, GUARD_LIMITS } from "@/lib/gemini-guard";

describe("Gemini の交通整理", () => {
  it("1人が1分に使える回数を超えたら断り、1分経てば戻る", () => {
    let t = 0;
    const guard = createGeminiGuard(() => t);
    for (let i = 0; i < GUARD_LIMITS.perMinute; i += 1) {
      const slot = guard.acquire("a");
      expect(slot.ok).toBe(true);
      if (slot.ok) slot.release();
    }
    const over = guard.acquire("a");
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.reason).toBe("rate");
    // 別の人は影響を受けない
    expect(guard.acquire("b").ok).toBe(true);
    t += 61_000;
    expect(guard.acquire("a").ok).toBe(true);
  });

  it("同時に呼んでいる数が上限なら busy、終われば空く", () => {
    const guard = createGeminiGuard(() => 0);
    const held = Array.from({ length: GUARD_LIMITS.concurrent }, (_, i) => guard.acquire(`u${i}`));
    expect(held.every((slot) => slot.ok)).toBe(true);
    const blocked = guard.acquire("late");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe("busy");
    const first = held[0]!;
    if (first.ok) first.release();
    expect(guard.acquire("late").ok).toBe(true);
  });

  it("書き出しの結果だけ使い回し、期限が切れたら消す", () => {
    let t = 0;
    const guard = createGeminiGuard(() => t);
    const key = guard.cacheKey("旅行", [], 12);
    expect(guard.cacheKey("旅行", ["a", "b"], 12)).toBeNull();
    guard.writeCache(key, ["温泉", "駅弁"]);
    expect(guard.readCache(guard.cacheKey("旅行 ", [], 12))).toEqual(["温泉", "駅弁"]);
    t += GUARD_LIMITS.cacheMs + 1;
    expect(guard.readCache(key)).toBeNull();
  });

  it("プロキシの先頭 IP をキーにする", () => {
    expect(clientKeyFromHeaders(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientKeyFromHeaders(new Headers())).toBe("unknown");
  });
});
