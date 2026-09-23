import { describe, expect, it } from "vitest";

import { DEFAULT_MODEL, GEMINI_FALLBACK_MODELS, resolveGeminiModel } from "@/lib/constants";
import { redactSecret } from "@/lib/env-secret";
import {
  GeminiRequestError,
  fallbackModels,
  geminiDebug,
  geminiFailureWarning,
  parseGoogleError,
  parseTopics,
  shouldTryNextModel,
} from "@/lib/gemini-core";

describe("Gemini の返答パース", () => {
  it("JSON配列から重複とお題を除く", () => {
    const topics = parseTopics('["温泉","温泉","旅行","お題"]', "お題", ["旅行"]);
    expect(topics).toEqual(["温泉"]);
  });
});

describe("Gemini の失敗メッセージ", () => {
  it("キーやURLを含めず、reason を日本語に載せる", () => {
    const debug = geminiDebug({
      reason: "http-403",
      httpStatus: 403,
      googleStatus: "PERMISSION_DENIED",
      model: "gemini-3.5-flash",
    });
    expect(debug.kind).toBe("http");
    expect(debug.host).toBe("generativelanguage.googleapis.com");
    const warning = geminiFailureWarning(new GeminiRequestError("http", debug));
    expect(warning).toBe(
      "Gemini がキーを受け付けませんでした（http-403 PERMISSION_DENIED・gemini-3.5-flash）。オフライン生成を使いました。",
    );
    expect(warning).not.toMatch(/AIza|key=/i);
    expect(
      geminiFailureWarning(new GeminiRequestError("timeout", geminiDebug({ reason: "timeout", model: "gemini-3.5-flash" }))),
    ).toBe("Gemini が時間切れです（timeout・12秒・gemini-3.5-flash）。オフライン生成を使いました。");
  });

  it("混雑は 503 を日本語で出す", () => {
    const error = new GeminiRequestError(
      "http",
      geminiDebug({
        reason: "http-503",
        httpStatus: 503,
        googleStatus: "UNAVAILABLE",
        model: "gemini-flash-latest",
        tried: ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"],
      }),
    );
    expect(geminiFailureWarning(error)).toBe(
      "Gemini が混み合っています（http-503 UNAVAILABLE・gemini-flash-latest）。オフライン生成を使いました。",
    );
  });

  it("ネットワーク失敗は host だけ出す", () => {
    const error = new GeminiRequestError(
      "network",
      geminiDebug({ reason: "network", model: "gemini-3.5-flash", googleMessage: "TypeError" }),
    );
    expect(geminiFailureWarning(error)).toBe(
      "Gemini に届きませんでした（network・generativelanguage.googleapis.com・gemini-3.5-flash）。オフライン生成を使いました。",
    );
    expect(error.debug.kind).toBe("network");
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

describe("Gemini のモデル切り替え", () => {
  it("廃止モデルは既定に置き、404 と 503 は次を試す", () => {
    expect(resolveGeminiModel("gemini-2.0-flash")).toBe(DEFAULT_MODEL);
    expect(fallbackModels("gemini-2.0-flash")[0]).toBe(DEFAULT_MODEL);
    expect(fallbackModels("gemini-2.0-flash")).toEqual([DEFAULT_MODEL, ...GEMINI_FALLBACK_MODELS]);
    expect(GEMINI_FALLBACK_MODELS).toContain("gemini-2.5-flash");
    expect(GEMINI_FALLBACK_MODELS).toContain("gemini-flash-latest");

    const notFound = new GeminiRequestError("http", geminiDebug({ reason: "http-404", httpStatus: 404, model: "gemini-2.0-flash" }));
    const busy = new GeminiRequestError(
      "http",
      geminiDebug({ reason: "http-503", httpStatus: 503, googleStatus: "UNAVAILABLE", model: "gemini-flash-latest" }),
    );
    const denied = new GeminiRequestError(
      "http",
      geminiDebug({ reason: "http-403", httpStatus: 403, googleStatus: "PERMISSION_DENIED", model: DEFAULT_MODEL }),
    );
    expect(shouldTryNextModel(notFound)).toBe(true);
    expect(shouldTryNextModel(busy)).toBe(true);
    expect(shouldTryNextModel(denied)).toBe(false);
  });
});
