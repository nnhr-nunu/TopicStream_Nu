import { describe, expect, it } from "vitest";

import {
  addTopic,
  BOX_LIMIT,
  clearTopics,
  emptyTopicBox,
  parseListenerTopic,
  removeTopic,
  sortTopics,
  topicKey,
} from "@/lib/listener-topics";

describe("コメントからお題を拾う", () => {
  it("先頭の「お題:」「お題：」「#お題」「【お題】」だけ拾う", () => {
    expect(parseListenerTopic("お題:夏の思い出")).toEqual({ topic: "夏の思い出" });
    expect(parseListenerTopic("お題：学生時代のバイト")).toEqual({ topic: "学生時代のバイト" });
    expect(parseListenerTopic("＃お題　最近買ってよかった物")).toEqual({ topic: "最近買ってよかった物" });
    expect(parseListenerTopic("#お題:猫")).toEqual({ topic: "猫" });
    expect(parseListenerTopic("【お題】初めての一人旅")).toEqual({ topic: "初めての一人旅" });
    expect(parseListenerTopic("  お題 : 好きな季節 ")).toEqual({ topic: "好きな季節" });
  });

  it("お題のコメントでないものは null（途中の「お題」・区切りの無いもの）", () => {
    expect(parseListenerTopic("お題箱いいね")).toBeNull();
    expect(parseListenerTopic("お題 ほしい")).toBeNull();
    expect(parseListenerTopic("今日のお題:夏")).toBeNull();
    expect(parseListenerTopic("1E ❤")).toBeNull();
  });

  it("かぎかっこを外し、空白をまとめる", () => {
    expect(parseListenerTopic("お題:「夏 の  思い出」")).toEqual({ topic: "夏 の 思い出" });
    expect(parseListenerTopic("お題:『推しの話』")).toEqual({ topic: "推しの話" });
  });

  it("使えないお題は topic: null（空・長すぎ・w だけ・URL・暴言）", () => {
    expect(parseListenerTopic("お題:")).toEqual({ topic: null });
    expect(parseListenerTopic("お題:ｗｗｗ")).toEqual({ topic: null });
    expect(parseListenerTopic("お題:！？")).toEqual({ topic: null });
    expect(parseListenerTopic(`お題:${"あ".repeat(31)}`)).toEqual({ topic: null });
    expect(parseListenerTopic("お題:https://example.com/a")).toEqual({ topic: null });
    expect(parseListenerTopic("お題:死ね")).toEqual({ topic: null });
  });

  it("重い悩みは通す", () => {
    expect(parseListenerTopic("お題:消えたいと思った夜")).toEqual({ topic: "消えたいと思った夜" });
  });
});

describe("同じお題とみなす", () => {
  it("全角半角・空白・大文字小文字・末尾の！？w をそろえる", () => {
    expect(topicKey("夏の思い出！！")).toBe(topicKey("夏の 思い出"));
    expect(topicKey("ＡＰＥＸ")).toBe(topicKey("apex"));
    expect(topicKey("猫ｗｗ")).toBe(topicKey("猫"));
  });

  it("英単語の終わりの w は消さない", () => {
    expect(topicKey("bow")).not.toBe(topicKey("bo"));
  });
});

describe("お題箱", () => {
  it("同じお題は数をまとめ、最初の書き方を残す", () => {
    let box = emptyTopicBox();
    box = addTopic(box, "夏の思い出", 1);
    box = addTopic(box, "夏の思い出！", 2);
    expect(box.topics).toEqual([{ key: topicKey("夏の思い出"), label: "夏の思い出", count: 2, lastAt: 2 }]);
  });

  it("数の多い順、同じ数なら新しい順に並べる", () => {
    let box = emptyTopicBox();
    box = addTopic(box, "A", 1);
    box = addTopic(box, "B", 2);
    box = addTopic(box, "C", 3);
    box = addTopic(box, "A", 4);
    expect(sortTopics(box.topics).map((topic) => topic.label)).toEqual(["A", "C", "B"]);
  });

  it(`${BOX_LIMIT} 件を超えたら、いちばん後ろ（少なくて古い）を落とす`, () => {
    let box = emptyTopicBox();
    box = addTopic(box, "人気", 0);
    box = addTopic(box, "人気", 0);
    for (let index = 0; index < BOX_LIMIT; index += 1) box = addTopic(box, `お題${index}`, index + 1);
    expect(box.topics).toHaveLength(BOX_LIMIT);
    const labels = box.topics.map((topic) => topic.label);
    expect(labels).toContain("人気");
    expect(labels).not.toContain("お題0");
    expect(labels).toContain(`お題${BOX_LIMIT - 1}`);
  });

  it("満杯でみんな 2 票以上でも、新しいお題は入る（いちばん後ろと入れ替える）", () => {
    let box = emptyTopicBox();
    for (let index = 0; index < BOX_LIMIT; index += 1) {
      box = addTopic(box, `お題${index}`, index + 1);
      box = addTopic(box, `お題${index}`, index + 1);
    }
    box = addTopic(box, "新しい", 100);
    expect(box.topics).toHaveLength(BOX_LIMIT);
    const labels = box.topics.map((topic) => topic.label);
    expect(labels).toContain("新しい");
    expect(labels).not.toContain("お題0");
  });

  it("消した・使ったお題は、同じ言葉が来ても戻さない", () => {
    let box = addTopic(emptyTopicBox(), "夏の思い出", 1);
    box = removeTopic(box, topicKey("夏の思い出"));
    expect(box.topics).toEqual([]);
    box = addTopic(box, "夏の思い出！", 2);
    expect(box.topics).toEqual([]);
  });

  it("全部消すと、今あるお題はすべて戻さない", () => {
    let box = addTopic(addTopic(emptyTopicBox(), "A", 1), "B", 2);
    box = clearTopics(box);
    expect(box.topics).toEqual([]);
    box = addTopic(addTopic(box, "A", 3), "C", 4);
    expect(box.topics.map((topic) => topic.label)).toEqual(["C"]);
  });
});
