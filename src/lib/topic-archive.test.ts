import { describe, expect, it } from "vitest";

import { LABEL_MAX } from "@/lib/constants";
import { THEME_MAP } from "@/lib/mock-topics";
import { MODE_PRESETS } from "@/lib/modes";
import { STARTER_TOPICS } from "@/lib/starters";
import { isArchived, withoutArchived } from "@/lib/topic-archive";
import { ARCHIVED_SEEDS, BY_SEED, CATEGORY_FIXES } from "@/lib/topic-archive-data";
import { isCategoryId, normalizeSeed, recordPick, recordTopics, similarity } from "@/lib/topic-knowledge";
import { SEED_MODE_TOPICS, SEED_TOPICS } from "@/lib/topic-knowledge-seed-data";

describe("topic-archive", () => {
  it("お題ごとのアーカイブは、そのお題の下でだけ隠す", () => {
    expect(isArchived("最近買ってよかったもの", "高級トースター")).toBe(true);
    expect(isArchived("今欲しい家電", "高級トースター")).toBe(false);
  });

  it("どこでも隠す語は、お題を問わず隠す", () => {
    expect(isArchived("何でも", "高級な高級ヘッドホン")).toBe(true);
  });

  it("図鑑から隠した語と、その票を外す。語が残らないお題は出さない", () => {
    let store = recordTopics({}, "最近買ってよかったもの", ["高級トースター", "買って後悔したもの"], 0);
    store = recordPick(store, "最近買ってよかったもの", "高級トースター", "heart");
    store = recordTopics(store, "衝動買いしたもの", ["衝動の全貌"], 0);

    const shown = withoutArchived(store);
    const entry = Object.values(shown).find((item) => item.seed === "最近買ってよかったもの")!;
    expect(Object.keys(entry.topics)).toEqual(["買って後悔したもの"]);
    expect(entry.picks).toBeUndefined();
    expect(Object.values(shown).some((item) => item.seed === "衝動買いしたもの")).toBe(false);
  });
});

describe("図鑑の棚卸し（公開前）", () => {
  const bundledKeys = () => {
    const keys = new Set<string>();
    for (const seed of [...Object.keys(THEME_MAP), ...Object.keys(SEED_TOPICS)]) keys.add(normalizeSeed(seed));
    for (const seeds of Object.values(SEED_MODE_TOPICS)) for (const seed of Object.keys(seeds ?? {})) keys.add(normalizeSeed(seed));
    return keys;
  };

  it("お題ごと隠す一覧は重複せず、同梱の手書きのお題を巻き込まない", () => {
    const normalized = ARCHIVED_SEEDS.map(normalizeSeed);
    expect(new Set(normalized).size).toBe(normalized.length);
    const bundled = bundledKeys();
    expect(normalized.filter((seed) => bundled.has(seed))).toEqual([]);
  });

  it("語を隠す指定は、同梱の手書きの語を巻き込まない", () => {
    const own = new Map<string, Set<string>>();
    const add = (seed: string, topics: string[]) => {
      const key = normalizeSeed(seed);
      own.set(key, new Set([...(own.get(key) ?? []), ...topics.map(normalizeSeed)]));
    };
    for (const [seed, topics] of [...Object.entries(THEME_MAP), ...Object.entries(SEED_TOPICS)]) add(seed, topics);
    for (const seeds of Object.values(SEED_MODE_TOPICS)) for (const [seed, topics] of Object.entries(seeds ?? {})) add(seed, topics);
    const hit: string[] = [];
    for (const [seed, topics] of Object.entries(BY_SEED)) {
      for (const topic of topics) if (own.get(normalizeSeed(seed))?.has(normalizeSeed(topic))) hit.push(`${seed} / ${topic}`);
    }
    expect(hit).toEqual([]);
  });

  it("分類の付け直しは、存在する分類だけ", () => {
    for (const [seed, category] of Object.entries(CATEGORY_FIXES)) expect(isCategoryId(category), seed).toBe(true);
  });

  it("隠したお題は図鑑に出さず、分類は付け直す", () => {
    let store = recordTopics({}, "心が軽くなる瞬間", ["深呼吸できる瞬間"], 0, 1, "advice");
    store = recordTopics(store, "うさぎ", ["干支としてのうさぎ"], 0);
    store = recordTopics(store, "焼き鳥", ["串から外す論争", "定番の部位", "苦手な部位"], 0);
    const shown = withoutArchived(store);
    expect(Object.values(shown).map((entry) => entry.seed)).toEqual(["焼き鳥"]);
    expect(Object.values(shown)[0]!.category).toBe("food");
  });

  it("スターター（ホームの最初の話題）には、専用の初期データがある。無いと似ていないお題の語を借りて話がずれる", () => {
    const keys = [...Object.keys(THEME_MAP), ...Object.keys(SEED_TOPICS)];
    const lacking = STARTER_TOPICS.filter((starter) => !keys.some((key) => similarity(starter, key) >= 0.8));
    expect(lacking).toEqual([]);
  });

  it("雑談以外のモードのスターターにも、初期データがある", () => {
    for (const preset of MODE_PRESETS) {
      if (preset.starters.length === 0) continue;
      const seeds = Object.keys(SEED_MODE_TOPICS[preset.id] ?? {});
      expect(preset.starters.filter((starter) => !seeds.includes(starter)), preset.label).toEqual([]);
    }
  });

  it("雑談以外のモードの初期データも、カードに収まる長さで、重複しない", () => {
    for (const [mode, seeds] of Object.entries(SEED_MODE_TOPICS)) {
      for (const [seed, topics] of Object.entries(seeds ?? {})) {
        expect(topics.length, `${mode} / ${seed}`).toBeGreaterThanOrEqual(8);
        expect(new Set(topics).size, `${mode} / ${seed}`).toBe(topics.length);
        for (const label of topics) expect(label.length, `${mode} / ${seed} / ${label}`).toBeLessThanOrEqual(LABEL_MAX);
      }
    }
  });
});
