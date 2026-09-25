import { describe, expect, it } from "vitest";

import { mockRelatedTopics } from "@/lib/mock-topics";

describe("オフラインの候補", () => {
  it("図鑑に無いお題でも、お題の語をつなげただけの候補（昔の〇〇・〇〇の沼）を出さない", () => {
    const topics = mockRelatedTopics("焼き鳥", [], 12);
    expect(topics).toHaveLength(12);
    expect(topics.filter((label) => label.includes("焼き鳥"))).toEqual([]);
    expect(new Set(topics).size).toBe(12);
  });

  it("盤面にある語は出さない", () => {
    const first = mockRelatedTopics("焼き鳥", [], 8);
    const next = mockRelatedTopics("焼き鳥", first, 8);
    expect(next.filter((label) => first.includes(label))).toEqual([]);
  });

  it("定番の語があるお題はそれを先に使う", () => {
    const topics = mockRelatedTopics("雨の日の過ごし方", [], 8);
    expect(topics).toContain("雨音ASMR");
  });
});
