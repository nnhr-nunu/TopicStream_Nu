import { describe, expect, it } from "vitest";

import { ambientCards, pickAmbientKind } from "@/lib/ambient-critters";
import { CRITTER_KINDS } from "@/lib/wait-critters";

/** 2 列 × 4 行のカードの一覧（高さ 150、行の間 12） */
const list = Array.from({ length: 8 }, (_, index) => ({ x: (index % 2) * 312, y: Math.floor(index / 2) * 162, w: 300, h: 150 }));

describe("ほかの画面に遊びに来る動物", () => {
  it("水の動物・しまった動物は出さず、できれば前回と違う子", () => {
    for (let step = 0; step < 50; step += 1) {
      const kind = pickAmbientKind(["frog"], Math.random, "cat");
      expect(["goldfish", "dolphin", "frog", "cat"]).not.toContain(kind);
    }
    expect(pickAmbientKind([...CRITTER_KINDS], Math.random)).toBeNull();
  });

  it("上の縁が見えている行のカードで遊ぶ（下の行も見えていれば足すことがある）", () => {
    const cards = ambientCards(list, { top: 100, bottom: 600 }, () => 0);
    expect(cards?.map((card) => card.y)).toEqual([162, 162, 324, 324]);
    const one = ambientCards(list, { top: 100, bottom: 600 }, () => 0.99);
    expect(one?.every((card) => card.y === 486)).toBe(true);
  });

  it("見えている行が無ければ出ない", () => {
    expect(ambientCards(list, { top: 2000, bottom: 2600 }, Math.random)).toBeNull();
  });
});
