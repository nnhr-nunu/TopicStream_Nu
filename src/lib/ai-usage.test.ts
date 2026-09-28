import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadAiUsage, pacificDay, recordAiUsage } from "@/lib/ai-usage";

describe("AI の利用状況", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
      },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("日付は太平洋時間で区切る（日本時間の夕方に変わる）", () => {
    expect(pacificDay(Date.parse("2026-09-29T15:00:00+09:00"))).toBe("2026-09-28");
    expect(pacificDay(Date.parse("2026-09-29T17:00:00+09:00"))).toBe("2026-09-29");
  });

  it("呼んだ回数・トークン・失敗の理由をためる。キー無し版は数えない", () => {
    const now = Date.parse("2026-09-29T12:00:00+09:00");
    recordAiUsage({ topics: [], source: "gemini", usage: { calls: 2, tokens: 300 } }, now);
    recordAiUsage(
      {
        topics: [],
        source: "mock",
        usage: { calls: 3, tokens: 0 },
        debug: { reason: "http-503", googleStatus: "UNAVAILABLE", host: "h", model: "m", attempts: ["a", "b"] },
      },
      now,
    );
    recordAiUsage({ topics: [], source: "mock", debug: { reason: "missing-key", host: "h", model: "m" } }, now);
    const usage = loadAiUsage(now);
    expect(usage).toMatchObject({ requests: 2, calls: 5, tokens: 300, fallbacks: 1, failures: { "http-503 UNAVAILABLE": 1 } });
    expect(usage.last?.model).toBe("m");
    // 次の日（太平洋時間）には 0 から
    expect(loadAiUsage(now + 24 * 60 * 60_000).requests).toBe(0);
  });
});
