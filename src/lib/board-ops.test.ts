import { describe, expect, it } from "vitest";

import * as ops from "@/lib/board-ops";
import { normalizePrefs } from "@/lib/node-box";
import { emptyBoard } from "@/lib/storage";
import type { Board, HistoryEntry } from "@/lib/types";

function labelsOf(board: Board): string[] {
  return board.nodes.map((node) => node.data.label).sort();
}

const radial = normalizePrefs({ generationLayout: "radial", density: "comfortable" });

describe("展開のやり直し", () => {
  it("一つ戻ると、その展開のノード・辺・付箋が残らない", () => {
    let board = ops.createRootBoard(emptyBoard("test"), "根", radial);
    const rootId = board.nodes[0]!.id;
    const started = ops.beginExpand(board, rootId, 8, radial)!;
    board = ops.fillExpand(started.board, rootId, started.childIds, ["A", "B", "C", "D", "E", "F", "G", "H"], radial);
    board = ops.setMemo(board, started.childIds[0]!, "話したいエピソード", radial);
    const history = ops.historyFromChildren(board, rootId, started.childIds, started.edgeIds);
    expect(history.nodes.some((node) => node.data.memo === "話したいエピソード")).toBe(true);

    const undone = ops.undoExpand(board, history);
    expect(undone.nodes).toHaveLength(1);
    expect(undone.nodes[0]!.id).toBe(rootId);
    expect(undone.edges).toHaveLength(0);
    expect(undone.nodes.some((node) => node.data.memo === "話したいエピソード")).toBe(false);
    expect(undone.nodes[0]!.data.expanded).toBe(false);

    const redone = ops.redoExpand(undone, history);
    expect(redone.nodes).toHaveLength(9);
    expect(redone.edges).toHaveLength(8);
    expect(redone.nodes.some((node) => node.data.memo === "話したいエピソード")).toBe(true);
    expect(labelsOf(redone)).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "根"].sort());
  });

  it("子を広げたあとに親を戻すと、孫も含めて消える", () => {
    let board = ops.createRootBoard(emptyBoard("test"), "根", radial);
    const rootId = board.nodes[0]!.id;
    const first = ops.beginExpand(board, rootId, 4, radial)!;
    board = ops.fillExpand(first.board, rootId, first.childIds, ["春", "夏", "秋", "冬"], radial);
    const parentHistory: HistoryEntry = ops.historyFromChildren(board, rootId, first.childIds, first.edgeIds);

    const childId = first.childIds[1]!;
    const nested = ops.beginExpand(board, childId, 3, radial)!;
    board = ops.fillExpand(nested.board, childId, nested.childIds, ["朝", "昼", "夜"], radial);
    board = ops.setMemo(board, nested.childIds[0]!, "孫のメモ", radial);

    const undone = ops.undoExpand(board, parentHistory);
    expect(undone.nodes.map((node) => node.data.label)).toEqual(["根"]);
    expect(undone.edges).toHaveLength(0);
    expect(undone.nodes.some((node) => node.data.memo === "孫のメモ")).toBe(false);
  });

  it("AI待ちのプレースホルダも、戻ると消える", () => {
    const board = ops.createRootBoard(emptyBoard("test"), "根", radial);
    const rootId = board.nodes[0]!.id;
    const started = ops.beginExpand(board, rootId, 6, radial)!;
    const history = ops.historyFromChildren(started.board, rootId, started.childIds, started.edgeIds);
    const undone = ops.undoExpand(started.board, history);
    expect(undone.nodes).toHaveLength(1);
    expect(undone.edges).toHaveLength(0);

    const filledLate = ops.fillExpand(undone, rootId, started.childIds, ["残る話題"], radial);
    expect(filledLate.nodes).toHaveLength(1);
    expect(filledLate.nodes.some((node) => node.data.label === "残る話題")).toBe(false);
  });

  it("マンダラートの最初の展開は辺なしで戻せる", () => {
    const prefs = normalizePrefs({ generationLayout: "mandala" });
    let board = ops.createRootBoard(emptyBoard("test"), "根", prefs);
    const rootId = board.nodes[0]!.id;
    const started = ops.beginExpand(board, rootId, 8, prefs)!;
    expect(started.edgeIds).toHaveLength(0);
    board = ops.fillExpand(started.board, rootId, started.childIds, ["A", "B", "C", "D", "E", "F", "G", "H"], prefs);
    expect(board.nodes).toHaveLength(9);
    expect(board.edges).toHaveLength(0);
    const history = ops.historyFromChildren(board, rootId, started.childIds, started.edgeIds);
    const undone = ops.undoExpand(board, history);
    expect(undone.nodes).toHaveLength(1);
    const redone = ops.redoExpand(undone, history);
    expect(redone.nodes).toHaveLength(9);
    expect(redone.edges).toHaveLength(0);
  });
});
