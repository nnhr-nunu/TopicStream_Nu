import { describe, expect, it } from "vitest";

import { LABEL_MAX } from "@/lib/constants";
import { buildPrompt } from "@/lib/gemini-core";
import { isGenericAngle, mockRelatedTopics } from "@/lib/mock-topics";
import { MODE_PRESETS, isDivisionLabel, modePreset, parseMode, isChatMode, withMode } from "@/lib/modes";
import { parseSnapshot } from "@/lib/storage";

describe("ボードの用途（モード）", () => {
  it("未設定・知らない値は雑談として扱い、みんなが作った話題マップに載せるのは雑談だけ", () => {
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

  it("雑談では、分け方のあるお題は種類で広げ、絞れたら中身を出すよう例ごと伝える", () => {
    const prompt = buildPrompt("地方の方言", [], 8);
    expect(prompt).toContain("1個を「地方ごとの方言」のような分け方そのもののカードにし");
    // 例は複数並ぶ（最初の例も残る）
    expect(prompt).toContain("お題「最近買ってよかったもの」なら");
    expect(prompt).toContain('"地方ごとの方言"');
    expect(prompt).toContain('"なんでやねん"');
    expect(buildPrompt("恐竜", [], 8, [], "learn")).toContain("主な種類・分け方");
  });

  it("「地方ごとの方言」のような分け方のカードを広げると、分けた一つ一つを並べるよう伝える", () => {
    expect(isDivisionLabel("地方ごとの方言")).toBe(true);
    expect(isDivisionLabel("ジャンル別の音楽")).toBe(true);
    expect(isDivisionLabel("ラーメンの種類")).toBe(true);
    expect(isDivisionLabel("地方の方言")).toBe(false);

    const marker = "このお題は分け方そのものです";
    expect(buildPrompt("地方ごとの方言", [], 8, ["地方の方言"])).toContain(marker);
    expect(buildPrompt("地方ごとの方言", [], 8, ["地方の方言"], "chat", true)).toContain(marker);
    expect(buildPrompt("地方の方言", [], 8)).not.toContain(marker);
    // 目標の「週ごとの目標」のようなものには足さない
    expect(buildPrompt("週ごとの目標", [], 8, [], "goal")).not.toContain(marker);
  });
});

describe("指示の安全と質の決まり（2026-10-16）", () => {
  it("雑談の指示に、分類の名前だけで終わらせない・意味に自信がない言葉は言葉だけ、が入る", () => {
    const prompt = buildPrompt("最近買ってよかったもの", [], 8);
    expect(prompt).toContain("分類の名前だけで終わらせない");
    expect(prompt).toContain("意味に自信がない言葉は、説明を付けず言葉だけにする");
    expect(prompt).toContain("家電の種類");
    expect(buildPrompt("仕事を辞めたい", [], 8, [], "advice")).not.toContain("分類の名前だけで終わらせない");
  });

  it("どの用途の指示にも、体の話を断定しない一文が入る", () => {
    for (const preset of MODE_PRESETS) {
      expect(buildPrompt("低血圧について", [], 8, [], preset.id)).toContain("診断・治し方・効き目");
    }
  });

  it("お悩み相談の窓口の切り口は、命や健康に関わる内容のときだけにする", () => {
    const prompt = buildPrompt("仕事を辞めたい", [], 8, [], "advice");
    expect(prompt).toContain("それ以外の相談では窓口の語を入れない");
  });
});
