import { describe, expect, it } from "vitest";

import { LABEL_MAX } from "@/lib/constants";
import { buildPrompt } from "@/lib/gemini-core";
import { isGenericAngle, mockRelatedTopics } from "@/lib/mock-topics";
import { MODE_PRESETS, modePreset, parseMode, isChatMode, withMode } from "@/lib/modes";
import { parseSnapshot } from "@/lib/storage";

describe("ボードの用途（モード）", () => {
  it("未設定・知らない値は雑談として扱い、みんなのトークテーマに載せるのは雑談だけ", () => {
    expect(parseMode(undefined)).toBe("chat");
    expect(parseMode("unknown")).toBe("chat");
    expect(parseMode("advice")).toBe("advice");
    expect(isChatMode(undefined)).toBe(true);
    for (const preset of MODE_PRESETS.filter((item) => item.id !== "chat")) {
      expect(isChatMode(preset.id)).toBe(false);
    }
  });

  it("雑談に戻すと mode の項目ごと消える", () => {
    expect(withMode({ mode: "goal" as const }, "chat")).toEqual({});
    expect(withMode({}, "idea")).toEqual({ mode: "idea" });
  });

  it("保存データを読み直しても用途が残る（雑談は書かない）", () => {
    const board = { id: "b1", name: "相談", nodes: [], edges: [], pinnedNodeId: null, focusedNodeId: null };
    const snapshot = parseSnapshot({
      version: 2,
      activeBoardId: "b1",
      boards: [{ ...board, mode: "advice" }, { ...board, id: "b2", mode: "bogus" }],
    });
    expect(snapshot.boards[0]?.mode).toBe("advice");
    expect(snapshot.boards[1]).not.toHaveProperty("mode");
  });

  it("オフラインの切り口は短く、系統の中で重ならない", () => {
    for (const preset of MODE_PRESETS) {
      const labels = preset.angleGroups.flatMap((group) => [...group.angles, ...group.followUps]);
      expect(new Set(labels).size).toBe(labels.length);
      for (const label of labels) expect(label.length).toBeLessThanOrEqual(LABEL_MAX);
    }
  });
});

describe("モードごとの生成", () => {
  it("雑談以外は、そのモードの切り口だけで 8 マスを埋める", () => {
    for (const preset of MODE_PRESETS.filter((item) => item.id !== "chat")) {
      const own = new Set(preset.angleGroups.flatMap((group) => [...group.angles, ...group.followUps]));
      const topics = mockRelatedTopics("仕事を辞めたい", [], 8, ["最近買ってよかったもの"], { mode: preset.id });
      expect(topics).toHaveLength(8);
      expect(topics.every((label) => own.has(label))).toBe(true);
    }
  });

  it("モードの切り口を広げると、その深掘りが先に出る", () => {
    expect(isGenericAngle("続ける場合")).toBe(true);
    const topics = mockRelatedTopics("続ける場合", [], 8, [], { context: ["仕事を辞めたい"], mode: "advice" });
    const followUps = modePreset("advice").angleGroups.find((group) => group.angles.includes("続ける場合"))!.followUps;
    expect(topics.slice(0, followUps.length).sort()).toEqual([...followUps].sort());
  });

  it("深く広げて切り口を使い切っても 8 マス埋まる", () => {
    const used = modePreset("goal").angleGroups.flatMap((group) => group.angles);
    expect(mockRelatedTopics("早起き", used, 8, [], { mode: "goal" })).toHaveLength(8);
  });

  it("AI への指示もモードで変わり、雑談の指示は今までどおり", () => {
    expect(buildPrompt("最近買ってよかったもの", [], 8)).toContain("VTuberの雑談配信の構成作家");
    const advice = buildPrompt("仕事を辞めたい", [], 8, [], "advice");
    expect(advice).toContain("説教・断定・診断はしない");
    expect(advice).not.toContain("VTuber");
    expect(buildPrompt("登録者1万人", [], 8, [], "goal")).toContain("具体的な行動");
  });
});
