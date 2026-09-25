import { describe, expect, it } from "vitest";

import { isArchived, withoutArchived } from "@/lib/topic-archive";
import { recordPick, recordTopics } from "@/lib/topic-knowledge";

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
