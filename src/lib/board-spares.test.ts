import { describe, expect, it } from "vitest";

import * as ops from "@/lib/board-ops";
import { addSpares, spareCount, spareHolderId, takeSpare } from "@/lib/board-spares";
import { normalizePrefs } from "@/lib/node-box";
import { emptyBoard } from "@/lib/storage";

const prefs = normalizePrefs({ generationLayout: "mandala" });

function started() {
  const board = ops.createRootBoard(emptyBoard("t"), "根", prefs);
  const rootId = board.nodes[0]!.id;
  return { rootId, ...ops.beginExpand(board, rootId, 8, prefs)! };
}

describe("1語ずつ埋める", () => {
  it("届いた順に空のカードへ入れ、空きが無くなったら filled=false", () => {
    const { board, childIds } = started();
    let current = board;
    const labels = ["A", "B", "C", "D", "E", "F", "G", "H", "余り"];
    const results = labels.map((label) => {
      const next = ops.fillNextPlaceholder(current, childIds, label, prefs);
      current = next.board;
      return next.filled;
    });
    expect(results).toEqual([true, true, true, true, true, true, true, true, false]);
    expect(current.nodes.filter((node) => node.data.placeholder)).toHaveLength(0);
    expect(current.nodes.map((node) => node.data.label)).not.toContain("余り");
  });
});

describe("作り直し用の予備", () => {
  it("中央に置き、盤面に無いものだけ1つずつ取り出す", () => {
    const { board, childIds, rootId } = started();
    const holder = spareHolderId(board, childIds, rootId);
    expect(holder).toBe(rootId);
    let current = addSpares(board, holder, ["予備1", "予備2", "根"]);
    expect(spareCount(current, holder)).toBe(2); // 盤面にある「根」は除く
    const first = takeSpare(current, holder);
    expect(first.label).toBe("予備1");
    current = first.board;
    expect(spareCount(current, holder)).toBe(1);
    current = takeSpare(current, holder).board;
    expect(takeSpare(current, holder).label).toBeNull();
  });
});

describe("マンダラートで開いたマスの予備の置き場", () => {
  it("新しい3×3の中央（写し）に置く", () => {
    const prefs2 = normalizePrefs({ generationLayout: "mandala" });
    let board = ops.createRootBoard(emptyBoard("t"), "根", prefs2);
    const rootId = board.nodes[0]!.id;
    const first = ops.beginExpand(board, rootId, 8, prefs2)!;
    board = ops.fillExpand(first.board, rootId, first.childIds, ["A", "B", "C", "D", "E", "F", "G", "H"], prefs2);
    const keyword = board.nodes.find((node) => node.data.label === "A")!;
    const nested = ops.beginExpand(board, keyword.id, 8, prefs2)!;
    const center = nested.board.nodes.find((node) => node.data.copiedFromId === keyword.id)!;
    expect(spareHolderId(nested.board, nested.childIds, keyword.id)).toBe(center.id);
  });
});
