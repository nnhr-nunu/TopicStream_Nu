import { describe, expect, it } from "vitest";

import {
  appendToMemo,
  buildExplainPrompt,
  clipSentence,
  EXPLAIN_MAX,
  explainQuery,
  offlineExplanation,
  parseExplanation,
} from "@/lib/explain";

describe("解説", () => {
  it("話の流れを大きいお題から順に渡し、「言葉：意味」のカードは語だけを聞く", () => {
    const prompt = buildExplainPrompt("ぶち：すごく", ["広島弁", "地方の方言"]);
    expect(prompt).toContain("カードの言葉: ぶち\n");
    expect(prompt).toContain("地方の方言 › 広島弁 › ぶち");
  });

  it("AI の返事の装飾と改行を落とし、長すぎれば文の切れ目で切る", () => {
    expect(parseExplanation("**解説:** 「ぶち」は広島弁で「とても」。\n- ぶちうまい、のように使う。")).toBe(
      "「ぶち」は広島弁で「とても」。ぶちうまい、のように使う。",
    );
    const long = `${"あ".repeat(70)}。${"い".repeat(70)}。`;
    expect(clipSentence(long, EXPLAIN_MAX)).toBe(`${"あ".repeat(70)}。`);
  });

  it("キーが無くても、「言葉：意味」のカードなら意味を言い、検索語は流れの近いお題を添える", () => {
    expect(offlineExplanation("ぶち：すごく", ["広島弁"]).text).toBe("「ぶち」は広島弁で「すごく」という意味。");
    expect(offlineExplanation("冬の朝の習慣", ["冬"]).text).toBe("");
    expect(explainQuery("じゃけん：だから", ["広島弁"])).toBe("広島弁 じゃけん");
    expect(explainQuery("広島弁の語尾", ["広島弁"])).toBe("広島弁の語尾");
  });

  it("付箋には改行して足し、入りきらない分は縮める", () => {
    expect(appendToMemo("", "とても。")).toBe("とても。");
    expect(appendToMemo("オチを言う", "とても。")).toBe("オチを言う\nとても。");
    expect(appendToMemo("とても。", "とても。")).toBe("とても。");
    expect(appendToMemo("メ".repeat(100), `${"あ".repeat(30)}。`).length).toBeLessThanOrEqual(EXPLAIN_MAX);
  });
});
