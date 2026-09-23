import { describe, expect, it } from "vitest";

import {
  GeminiRequestError,
  geminiDebug,
  geminiFailureWarning,
  parseGoogleError,
  parseTopics,
} from "@/lib/gemini-core";
import { redactSecret } from "@/lib/env-secret";

describe("Gemini の返答パース", () => {
  it("JSON配列から重複とお題を除く", () => {
    const topics = parseTopics('["温泉","温泉","旅行","お題"]', "お題", ["旅行"]);
    expect(topics).toEqual(["温泉"]);
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
        model: "gemini-2.0-flash",
      }),
    );
    const warning = geminiFailureWarning(error);
    expect(warning).toContain("http-403");
    expect(warning).toContain("PERMISSION_DENIED");
    expect(warning).toContain("gemini-2.0-flash");
    expect(warning).not.toMatch(/AIza|key=/i);
    expect(geminiFailureWarning(new GeminiRequestError("timeout", geminiDebug({ reason: "timeout", model: "gemini-2.0-flash" })))).toContain(
      "timeout",
    );
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
