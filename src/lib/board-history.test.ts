import { describe, expect, it } from "vitest";

import { fitHistories, type BoardHistory } from "@/lib/board-history";
import type { HistoryEntry } from "@/lib/types";

function entry(index: number): HistoryEntry {
  return { parentId: `p${index}`, childIds: [], edgeIds: [], nodes: [], edges: [] };
}

describe("戻す／進むの履歴の大きさ", () => {
  it("小さいときはそのまま", () => {
    const all: Record<string, BoardHistory> = { a: { undo: [entry(1), entry(2)], redo: [] } };
    expect(fitHistories(all).histories).toBe(all);
  });

  it("大きすぎるときは古い方から捨て、新しい操作は残す", () => {
    const undo = Array.from({ length: 40 }, (_, index) => entry(index));
    const { histories, text } = fitHistories({ a: { undo, redo: [] } }, 600);
    expect(text.length).toBeLessThanOrEqual(600);
    expect(histories.a!.undo.length).toBeGreaterThan(0);
    expect(histories.a!.undo.at(-1)!.parentId).toBe("p39");
  });
});
