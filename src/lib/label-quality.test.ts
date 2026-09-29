import { describe, expect, it } from "vitest";

import { diversifyLabels, isNearDuplicate, isRecordableSeed, isTruncatedLabel } from "@/lib/label-quality";

describe("isTruncatedLabel", () => {
  it("末尾が「…」の語は切れた語とみなす", () => {
    expect(isTruncatedLabel("絶対に負けられないイントネーシ…")).toBe(true);
    expect(isTruncatedLabel("続きがある...")).toBe(true);
    expect(isTruncatedLabel("途中の…ではない語")).toBe(false);
    expect(isTruncatedLabel("関西弁")).toBe(false);
  });
});

describe("diversifyLabels", () => {
  it("同じ書き出しの語は2個まで（「理不尽な〜」を並べない）", () => {
    const labels = ["理不尽な叱られ方", "理不尽なルール", "理不尽な減点", "理不尽な先輩", "校則の思い出"];
    expect(diversifyLabels(labels)).toEqual(["理不尽な叱られ方", "理不尽なルール", "校則の思い出"]);
  });

  it("書き出しを数えない指定なら、型がそろった語も残す（目標の分解の行動など）", () => {
    const labels = ["毎朝10分英単語", "毎朝10分ストレッチ", "毎朝10分日記", "毎朝10分散歩"];
    expect(diversifyLabels(labels, Infinity)).toEqual(labels);
  });

  it("ほぼ同じ語と切れた語を落とし、順番は保つ", () => {
    expect(diversifyLabels(["24時間連続配信", "耐久配信", "24時間連続配信の裏側", "見た目と味のギャップがすごかっ…"])).toEqual([
      "24時間連続配信",
      "耐久配信",
    ]);
  });

  it("短い語（4文字以下）は書き出しを数えない", () => {
    expect(diversifyLabels(["関西弁", "関西人", "関西風", "関西の味"])).toHaveLength(4);
  });
});

describe("isNearDuplicate", () => {
  it("含み合う語・表記ゆれだけの語は同じとみなす", () => {
    expect(isNearDuplicate("新幹線のトランプ", "新幹線のトランプ大会")).toBe(true);
    expect(isNearDuplicate("コンビニ、新作", "コンビニ新作")).toBe(true);
    expect(isNearDuplicate("新幹線のカードゲーム", "新幹線のトランプ大会")).toBe(false);
  });
});

describe("isRecordableSeed", () => {
  it("中心のお題を直接広げたときは記録してよい", () => {
    expect(isRecordableSeed("焼き鳥")).toBe(true);
    expect(isRecordableSeed("地元のイントネーション、他県だと笑われる？")).toBe(true);
    expect(isRecordableSeed("雪")).toBe(true);
  });

  it("切れたもの・掛け合わせ・「語：意味」は記録しない", () => {
    expect(isRecordableSeed("大人になってから気づいた正しい…")).toBe(false);
    expect(isRecordableSeed("ネットの面白いミーム × ボルゾイ")).toBe(false);
    expect(isRecordableSeed("わ：津軽弁の一人称")).toBe(false);
    expect(isRecordableSeed("")).toBe(false);
  });

  it("遠い文脈の中で出た切り口は記録しない。1つ離れた文脈では、短い語だけ記録しない", () => {
    expect(isRecordableSeed("誰もいない海辺の砂浜", ["夕方の空の色の変化", "夜が近づく独特の静けさ"])).toBe(false);
    expect(isRecordableSeed("コンビニの違い", ["出身地あるある"])).toBe(true);
    expect(isRecordableSeed("雪", ["好きな季節の過ごし方"])).toBe(false);
    expect(isRecordableSeed("秋", ["夏と冬どっち派"])).toBe(false);
  });
});

describe("対になる語", () => {
  it("「朝の〜」「夜の〜」のような対は別の語として残す", () => {
    expect(isNearDuplicate("朝のルーティン", "夜のルーティン")).toBe(false);
    expect(isNearDuplicate("昔の朝ごはん", "今の朝ごはん")).toBe(false);
  });
});
