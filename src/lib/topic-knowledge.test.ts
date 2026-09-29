import { describe, expect, it } from "vitest";

import { pickGrowCandidates } from "@/lib/knowledge-grow";
import { cleanForRecord, looksPersonal } from "@/lib/knowledge-server";
import {
  asKnowledgeEntry,
  classifyTopic,
  knowledgeCounts,
  knowledgeDepth,
  mergeStores,
  normalizeSeed,
  rankedTopics,
  recordPick,
  recordTopics,
  relatedEntries,
  searchKnowledge,
  SIMILAR_THRESHOLD,
  similarity,
  suggestFromKnowledge,
  topicSimilarity,
  type KnowledgeStore,
} from "@/lib/topic-knowledge";
import { LABEL_MAX } from "@/lib/constants";
import { seedKnowledge } from "@/lib/topic-knowledge-seed";
import { SEED_TOPICS } from "@/lib/topic-knowledge-seed-data";

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

  it("お題名を重く見て、語に紛れた言葉には引きずられない", () => {
    // 語に「配信」が混ざっても、お題が暮らしの話なら暮らしのまま
    expect(classifyTopic("クリスマスの過ごし方", ["ぼっち配信の同志", "サンタの正体発覚", "予約忘れの悲劇"])).toBe("life");
    expect(classifyTopic("最近行ったお店", ["推しコラボのカフェ", "予約が取れない", "看板猫がいる"])).toBe("food");
    expect(classifyTopic("理想の休日デート", ["雨の日の焦り", "お会計の作法", "カフェ巡り"])).toBe("people");
    expect(classifyTopic("解約し忘れ", ["動画配信サイト", "音楽ストリーミング"])).toBe("shopping");
  });

  it("お題名に当たる言葉が無いとき、語に1つ当たっただけでは決めない", () => {
    expect(classifyTopic("あれこれ", ["配信のハプニング", "気ままな散歩道"])).toBe("other");
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

describe("topicSimilarity", () => {
  it("「〜の思い出」「〜の過ごし方」のような共通の言い回しだけでは、似たお題とみなさない", () => {
    expect(topicSimilarity("部活の思い出", "給食の思い出")).toBeLessThan(SIMILAR_THRESHOLD);
    expect(topicSimilarity("好きな季節の過ごし方", "雨の日の過ごし方")).toBeLessThan(SIMILAR_THRESHOLD);
    expect(topicSimilarity("電車あるある", "一人暮らしあるある")).toBeLessThan(SIMILAR_THRESHOLD);
    expect(topicSimilarity("最近の小さな幸せ", "最近ちょっと頑張ったこと")).toBeLessThan(SIMILAR_THRESHOLD);
  });

  it("中身が同じなら、言い回しが違っても似ている", () => {
    expect(topicSimilarity("カラオケの十八番", "カラオケの十八番、今も同じ？")).toBeGreaterThan(0.6);
    expect(topicSimilarity("昔ハマってたゲーム", "最近ハマってるゲーム")).toBeGreaterThan(SIMILAR_THRESHOLD);
    // 中身が丸ごと入っていれば、少し近い
    expect(topicSimilarity("部活の思い出", "学生のころの部活、今もネタになる？")).toBeGreaterThanOrEqual(SIMILAR_THRESHOLD);
  });

  it("言い回しだけのお題は、何とも似ていない", () => {
    expect(topicSimilarity("思い出", "給食の思い出")).toBe(0);
  });
});

describe("お題自身の語が十分あるときの借り方", () => {
  const own = ["宿題は最終日", "ラジオ体操", "花火大会", "おばあちゃんの家", "プールの匂い", "自由研究", "虫取り", "夏祭りの屋台", "日焼けの跡", "大人の夏休み"];
  const other = ["牛乳の思い出", "好きだった献立", "揚げパン", "残せなかった", "おかわり争奪戦", "給食当番", "デザートじゃんけん", "今も食べたい"];

  it("別のお題（給食の思い出）の語を、共通の言い回しだけで借りない", () => {
    let store = recordTopics({}, "夏休みの思い出", own, 0, 2);
    store = recordTopics(store, "給食の思い出", other, 0, 2);
    for (let i = 0; i < 20; i += 1) {
      const picked = suggestFromKnowledge(store, "夏休みの思い出", [], 8, () => (i + 0.5) / 20);
      expect(picked.filter((label) => other.includes(label))).toEqual([]);
    }
  });

  it("お題自身の語が候補の数以上あれば、かなり似たお題の語は控えめにしか混ぜない", () => {
    let store = recordTopics({}, "カラオケの十八番", own, 0, 2);
    store = recordTopics(store, "カラオケの十八番、今も同じ？", other, 0, 2);
    let borrowed = 0;
    for (let i = 0; i < 40; i += 1) {
      borrowed += suggestFromKnowledge(store, "カラオケの十八番", [], 8, () => (i + 0.5) / 40).filter((label) => other.includes(label)).length;
    }
    expect(borrowed / (40 * 8)).toBeLessThan(0.15);
  });

  it("お題自身の語が足りないときは、似たお題の語で埋める", () => {
    let store = recordTopics({}, "カラオケの十八番", ["最初に歌う曲", "締めの曲"], 0, 2);
    store = recordTopics(store, "カラオケの十八番、今も同じ？", other, 0, 2);
    const picked = suggestFromKnowledge(store, "カラオケの十八番", [], 8, () => 0.5);
    expect(picked).toHaveLength(8);
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
  it("手書きの初期データはカードに収まる長さで、重複しない", () => {
    for (const [seed, topics] of Object.entries(SEED_TOPICS)) {
      expect(topics.length, seed).toBeGreaterThanOrEqual(8);
      expect(new Set(topics).size, seed).toBe(topics.length);
      for (const label of topics) expect(label.length, `${seed} / ${label}`).toBeLessThanOrEqual(LABEL_MAX);
    }
    expect(Object.keys(seedKnowledge()).length).toBeGreaterThanOrEqual(90);
  });

  it("同梱の図鑑でホームの定番お題が引ける", () => {
    const store = seedKnowledge();
    expect(knowledgeDepth(store, "最近買ってよかったもの")).toBeGreaterThanOrEqual(8);
    expect(knowledgeDepth(store, "眠れない夜にすること")).toBeGreaterThanOrEqual(8);
    expect(suggestFromKnowledge(store, "最近買ってよかった家電", [], 4)).toHaveLength(4);
  });
});

describe("knowledge-server", () => {
  it("記録前に長すぎる語・壊れた語・お題そのものを落とす", () => {
    expect(cleanForRecord("", ["a"])).toBeNull();
    expect(cleanForRecord("雨", ["雨", "]", "あ".repeat(45)])).toBeNull();
    expect(cleanForRecord("雨", ["雨音", "雨音", "傘"])).toEqual({ seed: "雨", topics: ["雨音", "傘"] });
  });

  it("途中で切れた語・掛け合わせ・「語：意味」は、単独のお題として記録しない", () => {
    expect(cleanForRecord("大人になってから気づいた正しい…", ["和菓子の食べ方"])).toBeNull();
    expect(cleanForRecord("ネットの面白いミーム × ボルゾイ", ["縦長の犬"])).toBeNull();
    expect(cleanForRecord("わ：津軽弁の一人称", ["な：あなた"])).toBeNull();
    expect(cleanForRecord("雨", ["見た目と味のギャップがすごかっ…", "雨音"])).toEqual({ seed: "雨", topics: ["雨音"] });
  });

  it("図鑑から隠したお題は記録しない", () => {
    expect(cleanForRecord("心が軽くなる瞬間", ["深呼吸できる瞬間"])).toBeNull();
    expect(cleanForRecord("焼き鳥", ["串から外す論争"])).not.toBeNull();
  });

  it("連絡先・URL・@ハンドルは記録しない", () => {
    expect(looksPersonal("https://example.com")).toBe(true);
    expect(looksPersonal("090-1234-5678")).toBe(true);
    expect(looksPersonal("連絡は@someone_ まで")).toBe(true);
    expect(looksPersonal("100均の神")).toBe(false);
    expect(looksPersonal("2024年のベスト")).toBe(false);
    expect(cleanForRecord("雨", ["雨音", "https://x.jp"])).toEqual({ seed: "雨", topics: ["雨音"] });
    expect(cleanForRecord("xx@example.com", ["雨音"])).toBeNull();
  });
});

describe("recordPick", () => {
  const base = recordTopics(recordTopics({}, "朝", ["白湯", "二度寝"]), "朝", ["白湯"]);

  it("選ばれた語を上に出す", () => {
    expect(rankedTopics(base["朝"]!)).toEqual(["白湯", "二度寝"]);
    const liked = recordPick(recordPick(base, "朝", "二度寝", "heart"), "朝", "二度寝", "expand");
    expect(liked["朝"]!.picks).toEqual({ 二度寝: 5 });
    expect(rankedTopics(liked["朝"]!)).toEqual(["二度寝", "白湯"]);
  });

  it("図鑑に無い語・お題でも、票と一緒に加える", () => {
    const added = recordPick(base, "朝", "朝焼け", "chat");
    expect(added["朝"]!.topics["朝焼け"]).toBe(1);
    expect(added["朝"]!.picks?.["朝焼け"]).toBe(3);
    const fresh = recordPick(base, "夜更かし", "深夜ラジオ", "edit");
    expect(fresh[normalizeSeed("夜更かし")]!.topics).toEqual({ 深夜ラジオ: 1 });
    expect(recordPick(base, "朝", "朝", "heart")).toBe(base);
  });

  it("票は重ねても保存し直しても残る", () => {
    const liked = recordPick(base, "朝", "白湯", "pin");
    expect(mergeStores(liked, liked)["朝"]!.picks).toEqual({ 白湯: 6 });
    expect(recordTopics(liked, "朝", ["朝日"])["朝"]!.picks).toEqual({ 白湯: 3 });
    expect(asKnowledgeEntry(JSON.parse(JSON.stringify(liked["朝"])))?.picks).toEqual({ 白湯: 3 });
  });
});

describe("pickGrowCandidates", () => {
  it("語の少ないお題と、よく選ばれた語（次のお題）を先に育てる", () => {
    let shared = recordTopics({}, "深夜の過ごし方", ["夜食", "ラジオ", "散歩"]);
    shared = recordPick(shared, "深夜の過ごし方", "ラジオ", "heart");
    const picked = pickGrowCandidates({}, shared, 10, () => 0);
    const seeds = picked.map((item) => item.seed);
    expect(seeds).toContain("深夜の過ごし方");
    expect(seeds).toContain("ラジオ");
    expect(seeds.indexOf("ラジオ")).toBeLessThan(seeds.indexOf("夜食"));
    expect(picked.find((item) => item.seed === "深夜の過ごし方")?.known).toHaveLength(3);
  });

  it("十分たまったお題は育てない・数を守る", () => {
    const many = Array.from({ length: 30 }, (_, index) => `語${index}`);
    const shared = recordTopics({}, "満タン", many);
    const seeds = pickGrowCandidates({}, shared, 3, () => 0).map((item) => item.seed);
    expect(seeds).not.toContain("満タン");
    expect(seeds).toHaveLength(3);
  });

  it("お悩み相談なども同じモードで育て、枠の一部を先に回す（切り口はお題にしない）", () => {
    let shared = recordTopics({}, "仕事を辞めたい", ["本当はどうしたい？"], Date.now(), 1, "advice");
    shared = recordPick(shared, "仕事を辞めたい", "本当はどうしたい？", "heart", Date.now(), "advice");
    for (let index = 0; index < 10; index += 1) shared = recordTopics(shared, `雑談${index}`, ["語"]);
    const picked = pickGrowCandidates({}, shared, 3, () => 0);
    expect(picked.find((item) => item.seed === "仕事を辞めたい")?.mode).toBe("advice");
    expect(picked.map((item) => item.seed)).not.toContain("本当はどうしたい？");
    expect(picked).toHaveLength(3);
  });
});

describe("recordSharedPicks（Redis 無し）", () => {
  it("図鑑に無い語も票と一緒に加え、連絡先らしき語は捨てる", async () => {
    const { recordSharedPicks, loadSharedKnowledge } = await import("@/lib/knowledge-server");
    const seed = `テスト用のお題${Math.random().toString(36).slice(2, 7)}`;
    const recorded = await recordSharedPicks([
      { seed, topic: "盛り上がった話題", kind: "chat" },
      { seed, topic: "盛り上がった話題", kind: "heart" },
      { seed, topic: "https://example.com", kind: "heart" },
    ]);
    expect(recorded).toBe(2);
    const entry = (await loadSharedKnowledge())[normalizeSeed(seed)];
    expect(entry?.topics["盛り上がった話題"]).toBe(1);
    expect(entry?.picks?.["盛り上がった話題"]).toBe(6);
  });
});

describe("モードごとの図鑑", () => {
  const store = recordTopics(
    recordTopics({}, "仕事", ["職場の人間関係", "向いていない気がする"], 0, 1, "advice"),
    "仕事",
    ["バイトの失敗談", "職場のあるある"],
    0,
  );

  it("同じお題でもモードごとに別のお題として記録し、候補は同じモードからだけ引く", () => {
    expect(Object.keys(store).sort()).toEqual(["advice|仕事", "仕事"]);
    expect(store["advice|仕事"]?.mode).toBe("advice");
    expect(store["仕事"]?.mode).toBeUndefined();
    expect(suggestFromKnowledge(store, "仕事", [], 10, fixed(0)).sort()).toEqual(["バイトの失敗談", "職場のあるある"]);
    expect(suggestFromKnowledge(store, "仕事", [], 10, fixed(0), "advice").sort()).toEqual([
      "向いていない気がする",
      "職場の人間関係",
    ]);
    expect(knowledgeDepth(store, "仕事", "idea")).toBe(0);
  });

  it("検索は既定で雑談だけ、モードを指定するとそのモードだけ", () => {
    expect(searchKnowledge(store, "").map((hit) => hit.entry.mode)).toEqual([undefined]);
    expect(searchKnowledge(store, "", "all", 60, "advice").map((hit) => hit.entry.mode)).toEqual(["advice"]);
    expect(searchKnowledge(store, "", "all", 60, "all")).toHaveLength(2);
  });

  it("票もモードごと。読み直してもモードが残る", () => {
    const picked = recordPick(store, "仕事", "休む勇気", "heart", 0, "advice");
    expect(picked["advice|仕事"]?.picks?.["休む勇気"]).toBe(3);
    expect(picked["仕事"]?.topics["休む勇気"]).toBeUndefined();
    expect(asKnowledgeEntry(JSON.parse(JSON.stringify(picked["advice|仕事"])))?.mode).toBe("advice");
  });
});

describe("「ずれている」の印", () => {
  it("出た回数を打ち消すと候補から消え、AI がまた出しても戻らない", () => {
    const base = recordTopics({}, "朝", ["二度寝", "朝ごはん"]);
    const rejected = recordPick(base, "朝", "二度寝", "wrong");
    expect(rejected["朝"]?.topics["二度寝"]).toBeUndefined();
    expect(rejected["朝"]?.topics["朝ごはん"]).toBe(1);
    expect(suggestFromKnowledge(rejected, "朝", [], 5)).not.toContain("二度寝");
    const again = recordTopics(rejected, "朝", ["二度寝"]);
    expect(again["朝"]?.topics["二度寝"]).toBeUndefined();
    // 保存し直しても（localStorage 経由）マイナスの票は残る
    expect(asKnowledgeEntry(JSON.parse(JSON.stringify(again["朝"])))?.picks?.["二度寝"]).toBe(-4);
  });

  it("よく選ばれた語は1回の印では消えない。図鑑に無い語は加えない", () => {
    // 2回出て ♡ も付いた語（強さ 5）は、印1つ（-4）では残る
    const base = recordPick(recordTopics(recordTopics({}, "朝", ["二度寝"]), "朝", ["二度寝"]), "朝", "二度寝", "heart");
    expect(recordPick(base, "朝", "二度寝", "wrong")["朝"]?.topics["二度寝"]).toBe(2);
    expect(recordPick(base, "朝", "寝坊", "wrong")["朝"]?.topics["寝坊"]).toBeUndefined();
  });
});

describe("図鑑ページのタグの数", () => {
  it("モードごと・分類ごとに図鑑全体から数える（検索結果の件数ではない）", () => {
    let store: KnowledgeStore = {};
    store = recordTopics(store, "夏休みの思い出", ["虫取り", "花火大会"], 1, 1, "chat");
    store = recordTopics(store, "ラーメン", ["味噌", "醤油", "豚骨"], 1, 1, "chat");
    store = recordTopics(store, "配信のネタ切れ", ["企画会議", "視聴者に聞く"], 1, 1, "idea");
    const counts = knowledgeCounts(store, "chat");
    expect(counts.modes).toEqual({ chat: 2, idea: 1 });
    expect(Object.values(counts.categories).reduce((sum, value) => sum + (value ?? 0), 0)).toBe(2);
    expect(counts.topics).toBe(5);
    expect(knowledgeCounts(store, "idea").topics).toBe(2);
  });
});
