import { describe, expect, it } from "vitest";

import { SEED_TOPIC_SCORES } from "@/lib/catalog-data";
import { mergePopularTopics, withMonthlyTopics } from "@/lib/popularity";
import { MONTHLY_TOPICS, pickMonthlyTopics } from "@/lib/starters";
import { seedKnowledge } from "@/lib/topic-knowledge-seed";
import { knowledgeKey } from "@/lib/topic-knowledge";

describe("mergePopularTopics", () => {
  it("サーバーの答えには手書きの点数が入っているので、二重に足さない", () => {
    const remote = [
      { label: "最近買ってよかったもの", score: 220 },
      { label: "本当によく使われたお題", score: 200 },
    ];
    const merged = mergePopularTopics(remote);
    expect(merged.find((item) => item.label === "最近買ってよかったもの")?.score).toBe(220);
    expect(merged[1]?.label).toBe("本当によく使われたお題");
  });

  it("サーバーを読めなかったときは、手書きの点数で並べる", () => {
    expect(mergePopularTopics()[0]?.label).toBe(SEED_TOPIC_SCORES[0]?.label);
  });
});

describe("今月のお題", () => {
  it("その月のお題から 2 つを、重ねずに選ぶ", () => {
    const picked = pickMonthlyTopics(new Date(2026, 9, 16), 2, () => 0);
    expect(picked).toHaveLength(2);
    expect(new Set(picked).size).toBe(2);
    expect(picked.every((label) => MONTHLY_TOPICS[10]!.includes(label))).toBe(true);
  });

  it("先頭に混ぜ、同じお題を二重に出さない", () => {
    const popular = [
      { label: "最近買ってよかったもの", score: 220 },
      { label: "ハロウィンの思い出", score: 50 },
    ];
    const merged = withMonthlyTopics(popular, ["ハロウィンの思い出", "秋にやりたいこと"]);
    expect(merged.map((item) => item.label)).toEqual(["ハロウィンの思い出", "秋にやりたいこと", "最近買ってよかったもの"]);
  });

  it("どの月のお題にも同梱の手書きの語がある（最初の 3×3 から AI を待たない）", () => {
    const bundled = seedKnowledge();
    for (const labels of Object.values(MONTHLY_TOPICS)) {
      for (const label of labels) expect(bundled[knowledgeKey(label)], label).toBeDefined();
    }
  });
});
