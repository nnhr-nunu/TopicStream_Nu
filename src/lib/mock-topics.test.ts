import { describe, expect, it } from "vitest";

import { isGenericAngle, mockRelatedTopics } from "@/lib/mock-topics";

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

  it("切り口のカードを広げると、その深掘りと元のお題の語を出し、別の切り口ばかりにしない", () => {
    const topics = mockRelatedTopics("一番の失敗談", [], 8, [], {
      context: ["雨の日の過ごし方"],
      related: ["梅雨の髪型"],
    });
    expect(topics).toHaveLength(8);
    const followUps = ["その瞬間どうした", "まわりの反応", "今なら笑える？", "二度としないこと", "実はまだ引きずってる", "同じ経験ある人いる？", "そこから学んだこと", "言い訳させて"];
    expect(topics.slice(0, 5).every((label) => followUps.includes(label))).toBe(true);
    expect(topics.filter((label) => isGenericAngle(label)).length).toBe(5);
    const themeWords = ["鍋が食べたい", "窓際でダラダラ", "雨音ASMR", "洗濯が乾かない", "好きな雨曲", "外出する派", "配信向きの天気", "雨の匂い"];
    expect(topics.filter((label) => themeWords.includes(label))).toHaveLength(3);
    expect(topics).not.toContain("雨の日の過ごし方");
  });

  it("図鑑に無いお題でも、元のお題の図鑑の語を使う", () => {
    const topics = mockRelatedTopics("つくね派", [], 8, [], { context: ["焼き鳥"], related: ["タレか塩か", "好きな部位"] });
    expect(topics.slice(0, 2)).toEqual(["タレか塩か", "好きな部位"]);
  });

  it("よく使われる話題（お題と無関係）は、切り口より後ろの埋め草にする", () => {
    const topics = mockRelatedTopics("焼き鳥", [], 8, ["最近買ってよかったもの", "鍋が食べたい"]);
    expect(topics).not.toContain("最近買ってよかったもの");
    expect(topics.every((label) => isGenericAngle(label))).toBe(true);
  });

  it("汎用の切り口を見分ける", () => {
    expect(isGenericAngle("一番の失敗談")).toBe(true);
    expect(isGenericAngle("その瞬間どうした")).toBe(true);
    expect(isGenericAngle("焼き鳥")).toBe(false);
  });
});

describe("オフラインの候補の長さ", () => {
  it("お題の一覧の長い文も、「…」で切らずにそのまま出すか、出さない", () => {
    const seen = new Set<string>();
    for (const seed of ["焼き鳥", "雨の日の過ごし方", "一番の失敗談", "地元に帰ると"]) {
      for (let i = 0; i < 4; i += 1) for (const label of mockRelatedTopics(seed, [...seen].slice(0, i * 8), 40)) seen.add(label);
    }
    expect([...seen].filter((label) => label.includes("…"))).toEqual([]);
    // お題の一覧（地元のイントネーション、他県だと笑われる？ など）が、切られずに候補に入る
    expect([...seen].some((label) => label.length > 16)).toBe(true);
  });
});

describe("候補を出し切ったとき", () => {
  it("盤面の語で候補が尽きても、近くの語だけ避けて埋める（雑談・ほかのモード）", () => {
    for (const mode of ["chat", "advice"] as const) {
      const used: string[] = [];
      for (let round = 0; round < 40; round += 1) used.push(...mockRelatedTopics("推し", used, 8, [], { mode }));
      const near = used.slice(-8);
      const next = mockRelatedTopics("推し", [...near, ...used], 8, [], { mode });
      expect(next.length, mode).toBe(8);
      expect(next.some((label) => near.includes(label)), mode).toBe(false);
    }
  });
});
