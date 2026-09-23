import { describe, expect, it } from "vitest";

import { parseTopics, GeminiRequestError, geminiFailureWarning } from "@/lib/gemini-core";

describe("Gemini の返答パース", () => {
  it("JSON配列から重複とお題を除く", () => {
    const topics = parseTopics('["温泉","温泉","旅行","お題"]', "お題", ["旅行"]);
    expect(topics).toEqual(["温泉"]);
  });
});

describe("Gemini の失敗メッセージ", () => {
  it("キーやURLを含めず、日本語で理由を返す", () => {
    const warning = geminiFailureWarning(new GeminiRequestError("http", 403));
    expect(warning).toContain("キーを受け付けませんでした");
    expect(warning).not.toMatch(/AIza|key=/i);
    expect(geminiFailureWarning(new GeminiRequestError("timeout"))).toContain("遅かった");
  });
});
