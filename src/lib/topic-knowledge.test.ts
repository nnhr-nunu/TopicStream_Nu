import { describe, expect, it } from "vitest";

import { cleanForRecord, isPublicEntry } from "@/lib/knowledge-server";
import {
  asKnowledgeEntry,
  classifyTopic,
  knowledgeDepth,
  mergeStores,
  normalizeSeed,
  recordTopics,
  relatedEntries,
  searchKnowledge,
  similarity,
  suggestFromKnowledge,
  type KnowledgeStore,
} from "@/lib/topic-knowledge";
import { seedKnowledge } from "@/lib/topic-knowledge-seed";

function fixed(value = 0.5) {
  return () => value;
}

describe("normalizeSeed", () => {
  it("表記ゆれ（全角・空白・末尾の？）を同じお題にまとめる", () => {
    expect(normalizeSeed("  好きな ＢＧＭ？ ")).toBe(normalizeSeed("好きな BGM"));
    expect(normalizeSeed("夏と冬どっち派！")).toBe("夏と冬どっち派");
  });
});

describe("classifyTopic", () => {
  it("お題の言葉から分類する", () => {
    expect(classifyTopic("昔ハマってたゲーム")).toBe("game");
    expect(classifyTopic("深夜に無性に食べたくなるもの")).toBe("food");
    expect(classifyTopic("今週の推し活")).toBe("oshi");
  });

  it("どれにも当たらなければ other", () => {
    expect(classifyTopic("あいうえお")).toBe("other");
  });

  it("お題で決まらないときは出てきた語で決める", () => {
    expect(classifyTopic("あれこれ", ["ラーメン", "カフェ巡り"])).toBe("food");
  });
});

describe("similarity", () => {
  it("似たお題ほど高い", () => {
    const near = similarity("昔ハマってたゲーム", "最近ハマってるゲーム");
    const far = similarity("昔ハマってたゲーム", "雨の日の過ごし方");
    expect(near).toBeGreaterThan(0.4);
    expect(far).toBeLessThan(0.2);
    expect(similarity("同じ", "同じ")).toBe(1);
  });
});

describe("recordTopics / mergeStores", () => {
  it("同じお題への記録は回数を足していく", () => {
    let store: KnowledgeStore = {};
    store = recordTopics(store, "好きなBGM", ["作業用", "ゲーム音楽"], 1);
    store = recordTopics(store, "好きなＢＧＭ？", ["作業用", "眠れる曲"], 2);
    const entry = store[normalizeSeed("好きなBGM")]!;
    expect(entry.seed).toBe("好きなBGM");
    expect(entry.uses).toBe(2);
    expect(entry.topics).toEqual({ 作業用: 2, ゲーム音楽: 1, 眠れる曲: 1 });
    expect(entry.updatedAt).toBe(2);
  });

  it("お題そのものと空の語は記録しない", () => {
    const store = recordTopics({}, "雨", ["雨", " ", "雨音"]);
    expect(Object.keys(store["雨"]!.topics)).toEqual(["雨音"]);
    expect(recordTopics({}, "雨", ["雨"])).toEqual({});
  });

  it("複数の保存先を重ねると回数が合算される", () => {
    const a = recordTopics({}, "朝", ["白湯"]);
    const b = recordTopics({}, "朝", ["白湯", "二度寝"]);
    const merged = mergeStores(a, b);
    expect(merged["朝"]!.topics).toEqual({ 白湯: 2, 二度寝: 1 });
    expect(merged["朝"]!.uses).toBe(2);
    // 元は変えない
    expect(a["朝"]!.topics).toEqual({ 白湯: 1 });
  });
});

describe("suggestFromKnowledge", () => {
  const store = mergeStores(
    recordTopics({}, "昔ハマってたゲーム", ["課金しすぎた", "神曲BGM", "友達と徹夜"]),
    recordTopics({}, "最近ハマってるゲーム", ["ガチャ運", "ランク戦"]),
    recordTopics({}, "雨の日の過ごし方", ["鍋が食べたい"]),
  );

  it("同じお題の語を出し、盤面にある語は出さない", () => {
    const picked = suggestFromKnowledge(store, "昔ハマってたゲーム", ["神曲BGM"], 10, fixed(0));
    expect(picked).toContain("課金しすぎた");
    expect(picked).not.toContain("神曲BGM");
    expect(picked).not.toContain("鍋が食べたい");
  });

  it("初めてのお題でも、似たお題の語を借りる", () => {
    const picked = suggestFromKnowledge(store, "ハマってたゲームの話", [], 10, fixed(0.3));
    expect(picked.length).toBeGreaterThan(0);
    expect(picked).not.toContain("鍋が食べたい");
  });

  it("数を超えて出さない・重複しない", () => {
    const picked = suggestFromKnowledge(store, "昔ハマってたゲーム", [], 2, Math.random);
    expect(picked).toHaveLength(2);
    expect(new Set(picked).size).toBe(2);
  });

  it("depth はお題そのものの語数", () => {
    expect(knowledgeDepth(store, "昔ハマってたゲーム")).toBe(3);
    expect(knowledgeDepth(store, "知らないお題")).toBe(0);
  });

  it("relatedEntries は同じお題を先頭にする", () => {
    const related = relatedEntries(store, "昔ハマってたゲーム");
    expect(related[0]?.exact).toBe(true);
    expect(related.some((item) => item.entry.seed === "最近ハマってるゲーム")).toBe(true);
  });
});

describe("searchKnowledge", () => {
  const store = mergeStores(
    recordTopics({}, "今週の推し活", ["グッズ開封", "遠征あるある"]),
    recordTopics({}, "料理で失敗した話", ["焦げた夜"]),
  );

  it("お題・語の部分一致で探せる", () => {
    expect(searchKnowledge(store, "推し").map((hit) => hit.entry.seed)).toEqual(["今週の推し活"]);
    const byTopic = searchKnowledge(store, "焦げ");
    expect(byTopic[0]?.entry.seed).toBe("料理で失敗した話");
    expect(byTopic[0]?.matchedTopics).toEqual(["焦げた夜"]);
  });

  it("分類で絞れる・空なら全部", () => {
    expect(searchKnowledge(store, "", "food").map((hit) => hit.entry.seed)).toEqual(["料理で失敗した話"]);
    expect(searchKnowledge(store, "")).toHaveLength(2);
  });
});

describe("asKnowledgeEntry", () => {
  it("壊れた行は捨て、足りない項目は補う", () => {
    expect(asKnowledgeEntry(null)).toBeNull();
    expect(asKnowledgeEntry({ seed: "a", topics: {} })).toBeNull();
    const entry = asKnowledgeEntry({ seed: "ゲーム", topics: { 課金: 2, 壊れ: "x", ゼロ: 0 } });
    expect(entry?.topics).toEqual({ 課金: 2 });
    expect(entry?.category).toBe("game");
    expect(entry?.uses).toBe(1);
  });
});

describe("seedKnowledge", () => {
  it("同梱の図鑑でホームの定番お題が引ける", () => {
    const store = seedKnowledge();
    expect(knowledgeDepth(store, "最近買ってよかったもの")).toBeGreaterThanOrEqual(8);
    expect(knowledgeDepth(store, "眠れない夜にすること")).toBe(8);
    expect(suggestFromKnowledge(store, "最近買ってよかった家電", [], 4)).toHaveLength(4);
  });
});

describe("knowledge-server", () => {
  it("記録前に長すぎる語・壊れた語・お題そのものを落とす", () => {
    expect(cleanForRecord("", ["a"])).toBeNull();
    expect(cleanForRecord("雨", ["雨", "]", "とても長すぎる語がここに入っていて記録できない"])).toBeNull();
    expect(cleanForRecord("雨", ["雨音", "雨音", "傘"])).toEqual({ seed: "雨", topics: ["雨音", "傘"] });
  });

  it("1回しか使われていないお題は一覧に出さない", () => {
    const once = recordTopics({}, "田中さんの家", ["庭"])[normalizeSeed("田中さんの家")]!;
    expect(isPublicEntry(once)).toBe(false);
    expect(isPublicEntry({ ...once, uses: 2 })).toBe(true);
  });
});
