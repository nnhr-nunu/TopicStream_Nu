import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_MODEL, GEMINI_FALLBACK_MODELS } from "@/lib/constants";
import { redactSecret } from "@/lib/env-secret";
import {
  GeminiRequestError,
  fallbackModels,
  geminiDebug,
  geminiFailureWarning,
  geminiRetry,
  parseGoogleError,
  isJunkTopic,
  padTopics,
  parseTopics,
  requestGemini,
  shouldTryNextModel,
  thinkingConfigFor,
} from "@/lib/gemini-core";

describe("Gemini の返答パース", () => {
  it("JSON配列から重複とお題を除く", () => {
    const topics = parseTopics('["温泉","温泉","旅行","お題"]', "お題", ["旅行"]);
    expect(topics).toEqual(["温泉"]);
  });

  it("きれいな JSON 配列 [\"a\",\"b\"] を取る", () => {
    expect(parseTopics('["a","b"]', "お題", [])).toEqual(["a", "b"]);
    expect(parseTopics('```json\n["温泉","湯けむり"]\n```', "お題", [])).toEqual(["温泉", "湯けむり"]);
  });

  it("壊れた 1A [\"緊張… から中身だけ残す", () => {
    expect(parseTopics('1A ["緊張でバクバクした瞬間"', "お題", [])).toEqual(["緊張でバクバクした瞬間"]);
    expect(parseTopics('1A ["緊張でバクバクした瞬間"]', "お題", [])).toEqual(["緊張でバクバクした瞬間"]);
  });

  it("単独の [ や引用符は捨てる", () => {
    expect(parseTopics("[", "お題", [])).toEqual([]);
    expect(parseTopics('"', "お題", [])).toEqual([]);
    expect(parseTopics("]", "お題", [])).toEqual([]);
    expect(parseTopics(",", "お題", [])).toEqual([]);
    expect(parseTopics(" [ ] ", "お題", [])).toEqual([]);
  });

  it("番号付きリストからキーワードだけ取る", () => {
    const raw = `1. 温泉旅行
2. 地元あるある
3) 深夜のコンビニ
- 推しの話`;
    expect(parseTopics(raw, "お題", [])).toEqual(["温泉旅行", "地元あるある", "深夜のコンビニ", "推しの話"]);
  });

  it("JSON の破片をマスに残さない", () => {
    expect(parseTopics('["a","b"] [', "お題", [])).toEqual(["a", "b"]);
    expect(isJunkTopic("[")).toBe(true);
    expect(isJunkTopic('"')).toBe(true);
    expect(isJunkTopic("温泉")).toBe(false);
  });
});

describe("足りない分の埋め", () => {
  it("パース後にだけモックで埋め、ゴミは混ぜない", () => {
    expect(padTopics(["温泉"], ["[", "湯けむり", "露天"], 3, "お題")).toEqual(["温泉", "湯けむり", "露天"]);
    expect(padTopics([], ["地元あるある", "失敗談"], 2, "お題")).toEqual(["地元あるある", "失敗談"]);
  });
});

describe("Gemini の失敗メッセージ", () => {
  it("キーやURLを含めず、reason を日本語に載せる", () => {
    const error = new GeminiRequestError(
      "http",
      geminiDebug({
        reason: "http-403",
        httpStatus: 403,
        googleStatus: "PERMISSION_DENIED",
        model: "gemini-2.5-flash",
      }),
    );
    const warning = geminiFailureWarning(error);
    expect(warning).toContain("http-403");
    expect(warning).toContain("PERMISSION_DENIED");
    expect(warning).toContain("gemini-2.5-flash");
    expect(warning).not.toMatch(/AIza|key=/i);
    expect(geminiFailureWarning(new GeminiRequestError("timeout", geminiDebug({ reason: "timeout", model: "gemini-2.5-flash" })))).toContain(
      "timeout",
    );
  });

  it("503 は混雑として扱い、汎用エラーにしない", () => {
    const warning = geminiFailureWarning(
      new GeminiRequestError(
        "http",
        geminiDebug({
          reason: "http-503",
          httpStatus: 503,
          googleStatus: "UNAVAILABLE",
          googleMessage: "This model is currently experiencing high demand.",
          model: "gemini-flash-latest",
        }),
      ),
    );
    expect(warning).toContain("混み合っています");
    expect(warning).toContain("http-503");
    expect(warning).toContain("UNAVAILABLE");
    expect(warning).not.toContain("エラーを返しました");
  });

  it("Google の error JSON から status と message を取り、キーを消す", () => {
    const parsed = parseGoogleError({
      error: {
        status: "PERMISSION_DENIED",
        message: "API key AIzaSyExample leaked key=secret",
      },
    });
    expect(parsed.googleStatus).toBe("PERMISSION_DENIED");
    expect(parsed.googleMessage).toContain("[redacted]");
    expect(parsed.googleMessage).not.toContain("AIzaSyExample");
    expect(redactSecret("key=AIzaSyExample")).toBe("key=[redacted]");
  });
});

describe("Gemini のモデル列とフォールバック", () => {
  it("既定の試行順は重複なしで Flash 系を並べる", () => {
    expect(DEFAULT_MODEL).toBe("gemini-3.5-flash-lite");
    expect([...GEMINI_FALLBACK_MODELS]).toEqual([
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gemini-3.1-flash-lite",
      "gemini-flash-latest",
    ]);
    // 提供終了・新規キーでは使えない 2.x を保存していても既定から試す
    expect(fallbackModels("gemini-2.0-flash")).toEqual([...GEMINI_FALLBACK_MODELS]);
    expect(fallbackModels("gemini-2.5-flash")).toEqual([...GEMINI_FALLBACK_MODELS]);
    expect(fallbackModels("gemini-3.8-flash")[0]).toBe("gemini-3.8-flash");
    expect(new Set(fallbackModels(DEFAULT_MODEL)).size).toBe(GEMINI_FALLBACK_MODELS.length);
  });

  it("思考は最小にする（遅さと空の返答の原因）", () => {
    expect(thinkingConfigFor("gemini-3.5-flash-lite")).toEqual({ thinkingLevel: "minimal" });
    expect(thinkingConfigFor("gemini-3.5-flash")).toEqual({ thinkingLevel: "minimal" });
    expect(thinkingConfigFor("gemini-3.8-flash")).toEqual({ thinkingLevel: "low" });
    expect(thinkingConfigFor("gemini-2.5-flash")).toEqual({ thinkingBudget: 0 });
    expect(thinkingConfigFor("gemini-flash-latest")).toBeUndefined();
  });

  it("時間切れも次のモデルへ進む", () => {
    expect(shouldTryNextModel(new GeminiRequestError("timeout", geminiDebug({ reason: "timeout", model: "x" })))).toBe(true);
  });

  it("利用枠の無い 429 は混雑と分けて伝える", () => {
    const quota = new GeminiRequestError(
      "http",
      geminiDebug({
        reason: "http-429",
        httpStatus: 429,
        googleStatus: "RESOURCE_EXHAUSTED",
        googleMessage: "You exceeded your current quota. limit: 0",
        model: "gemini-3.5-flash",
        attempts: ["gemini-3.5-flash-lite: http-429 RESOURCE_EXHAUSTED", "gemini-3.5-flash: http-429 RESOURCE_EXHAUSTED"],
      }),
    );
    const warning = geminiFailureWarning(quota);
    expect(warning).toContain("利用枠がありません");
    expect(warning).toContain("試したモデル");
    expect(warning).not.toContain("混み合って");
  });

  it("404・429・503・UNAVAILABLE・RESOURCE_EXHAUSTED は次モデルへ進む", () => {
    expect(shouldTryNextModel(new GeminiRequestError("http", geminiDebug({ reason: "http-404", httpStatus: 404, model: "x" })))).toBe(true);
    expect(shouldTryNextModel(new GeminiRequestError("http", geminiDebug({ reason: "http-429", httpStatus: 429, model: "x" })))).toBe(true);
    expect(shouldTryNextModel(new GeminiRequestError("http", geminiDebug({ reason: "http-503", httpStatus: 503, model: "x" })))).toBe(true);
    expect(
      shouldTryNextModel(
        new GeminiRequestError("http", geminiDebug({ reason: "http-503", httpStatus: 503, googleStatus: "UNAVAILABLE", model: "x" })),
      ),
    ).toBe(true);
    expect(
      shouldTryNextModel(
        new GeminiRequestError("http", geminiDebug({ reason: "http-429", httpStatus: 429, googleStatus: "RESOURCE_EXHAUSTED", model: "x" })),
      ),
    ).toBe(true);
    expect(shouldTryNextModel(new GeminiRequestError("http", geminiDebug({ reason: "http-403", httpStatus: 403, model: "x" })))).toBe(false);
  });
});

function googleError(status: number, googleStatus: string, message = "busy") {
  return {
    ok: false,
    status,
    json: async () => ({ error: { status: googleStatus, message } }),
  };
}

function googleOk(topics: string[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(topics) }] } }],
    }),
  };
}

describe("Gemini の混雑リトライ", () => {
  const originalSleep = geminiRetry.sleep;

  afterEach(() => {
    geminiRetry.sleep = originalSleep;
    vi.unstubAllGlobals();
  });

  it("404 のあと 503 でも次モデルへ進み、同一モデルは一度だけ待ち直す", async () => {
    const sleep = vi.fn(async () => {});
    geminiRetry.sleep = sleep;
    const calls: string[] = [];
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: { body?: string }) => {
        const url = String(input);
        calls.push(url);
        bodies.push(init?.body ?? "");
        if (url.includes("gemini-3.5-flash-lite")) return googleError(404, "NOT_FOUND");
        if (url.includes("models/gemini-3.5-flash:")) {
          const hits = calls.filter((item) => item.includes("models/gemini-3.5-flash:")).length;
          if (hits === 1) return googleError(503, "UNAVAILABLE", "This model is currently experiencing high demand.");
          return googleOk(["温泉", "湯けむり"]);
        }
        return googleError(503, "UNAVAILABLE");
      }),
    );

    const result = await requestGemini({
      seed: "お題",
      existing: [],
      apiKey: "test-key",
      model: DEFAULT_MODEL,
      count: 8,
    });

    expect(result.model).toBe("gemini-3.5-flash");
    expect(result.topics).toContain("温泉");
    expect(result.tried.slice(0, 2)).toEqual(["gemini-3.5-flash-lite", "gemini-3.5-flash"]);
    expect(sleep).toHaveBeenCalledWith(geminiRetry.sameModelMs);
    const sent = JSON.parse(bodies[1]!) as { generationConfig: Record<string, unknown> };
    expect(sent.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "minimal" });
    expect(sent.generationConfig.responseMimeType).toBe("application/json");
  });

  it("利用枠の無い 429 は同じモデルで待たず、試した結果を残す", async () => {
    const sleep = vi.fn(async () => {});
    geminiRetry.sleep = sleep;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => googleError(429, "RESOURCE_EXHAUSTED", "Quota exceeded for metric. limit: 0")),
    );
    const error = await requestGemini({ seed: "お題", existing: [], apiKey: "k", model: DEFAULT_MODEL, count: 8 }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(GeminiRequestError);
    expect((error as GeminiRequestError).debug.attempts).toHaveLength(GEMINI_FALLBACK_MODELS.length);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("有効な語が8個未満なら同じモデルでもう一度頼み、ゴミは残さない", async () => {
    const sleep = vi.fn(async () => {});
    geminiRetry.sleep = sleep;
    let hits = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        hits += 1;
        if (hits === 1) {
          return googleOk(["[", "緊張でバクバクした瞬間"]);
        }
        return googleOk(["地元あるある", "深夜のコンビニ", "失敗談", "推しの話", "雨の日", "初配信", "マイブーム", "部活の話"]);
      }),
    );

    const result = await requestGemini({
      seed: "お題",
      existing: [],
      apiKey: "test-key",
      model: DEFAULT_MODEL,
      count: 8,
    });

    expect(hits).toBe(2);
    expect(result.topics).not.toContain("[");
    expect(result.topics[0]).toBe("緊張でバクバクした瞬間");
    expect(result.topics).toHaveLength(8);
  });

  it("全部 503 なら最後のモデルをもう一度待つ", async () => {
    const sleep = vi.fn(async () => {});
    geminiRetry.sleep = sleep;
    let lastHits = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes("gemini-flash-latest")) {
          lastHits += 1;
          if (lastHits >= 3) return googleOk(["再試行"]);
        }
        return googleError(503, "UNAVAILABLE", "high demand");
      }),
    );

    const result = await requestGemini({
      seed: "お題",
      existing: [],
      apiKey: "test-key",
      model: DEFAULT_MODEL,
      count: 8,
    });

    expect(result.model).toBe("gemini-flash-latest");
    expect(result.topics).toContain("再試行");
    expect(result.tried).toEqual([...GEMINI_FALLBACK_MODELS]);
    expect(sleep).toHaveBeenCalledWith(geminiRetry.lastModelMs);
  });

  it("ストリーミングで8個そろったら、続きを待たずに打ち切る", async () => {
    const encoder = new TextEncoder();
    let pulledAfterEnough = 0;
    const sse = (text: string) => encoder.encode(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}

`);
    const pieces = [
      sse('["地元あるある","深夜のコンビニ","失敗談",'),
      sse('"推しの話","雨の日","初配信","マイブーム","部活の話"]'),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        body: new ReadableStream<Uint8Array>({
          pull(controller) {
            const next = pieces.shift();
            if (next) controller.enqueue(next);
            else pulledAfterEnough += 1; // ここに来たら「終わらない返答」を待ち続けている
          },
        }),
      })),
    );

    const result = await requestGemini({ seed: "お題", existing: [], apiKey: "k", model: DEFAULT_MODEL, count: 8 });
    expect(result.topics).toHaveLength(8);
    expect(result.topics).toContain("部活の話");
    expect(pulledAfterEnough).toBeLessThanOrEqual(1);
  });
});
