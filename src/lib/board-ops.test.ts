import { describe, expect, it } from "vitest";

import * as ops from "@/lib/board-ops";
import { emptyBoard } from "@/lib/storage";
import { hasOverlap, layoutBoard, minNodeGap, placeChildren, radiusFor } from "@/lib/radial";
import type { Board, HistoryEntry } from "@/lib/types";

function labelsOf(board: Board): string[] {
  return board.nodes.map((node) => node.data.label).sort();
}

describe("放射配置", () => {
  it("同じ世代の子は等間隔で、互いに重ならない", () => {
    const points = placeChildren({
      parent: { x: 0, y: 0 },
      count: 8,
      existing: [{ x: 0, y: 0 }],
      density: "comfortable",
      parentDepth: 0,
    });
    expect(points).toHaveLength(8);
    expect(hasOverlap([{ x: 0, y: 0 }, ...points], minNodeGap("comfortable"))).toBe(false);
  });

  it("二世代でもノードが重ならず、世代が外側のリングになる", () => {
    let board = ops.createRootBoard(emptyBoard("test"), "根", "comfortable");
    const rootId = board.nodes[0]!.id;
    const first = ops.beginExpand(board, rootId, 8, "comfortable");
    expect(first).not.toBeNull();
    board = ops.fillExpand(first!.board, rootId, first!.childIds, first!.childIds.map((_, i) => `子${i}`));
    const childId = board.nodes.find((node) => node.data.parentId === rootId)!.id;
    const second = ops.beginExpand(board, childId, 8, "comfortable");
    expect(second).not.toBeNull();
    board = ops.fillExpand(second!.board, childId, second!.childIds, second!.childIds.map((_, i) => `孫${i}`));
    board = layoutBoard(board, "comfortable");
    const points = board.nodes.map((node) => node.position);
    expect(hasOverlap(points, minNodeGap("comfortable") * 0.92)).toBe(false);
    const root = board.nodes.find((node) => node.id === rootId)!;
    const grandchild = board.nodes.find((node) => node.data.depth === 2)!;
    const child = board.nodes.find((node) => node.id === childId)!;
    const rootDist = Math.hypot(child.position.x - root.position.x, child.position.y - root.position.y);
    const grandDist = Math.hypot(grandchild.position.x - root.position.x, grandchild.position.y - root.position.y);
    const parentChild = Math.hypot(child.position.x - root.position.x, child.position.y - root.position.y);
    const childGrand = Math.hypot(grandchild.position.x - child.position.x, grandchild.position.y - child.position.y);
    expect(grandDist).toBeGreaterThan(rootDist);
    expect(parentChild).toBeLessThan(minNodeGap("comfortable") * 1.75);
    expect(childGrand).toBeLessThan(minNodeGap("comfortable") * 2.4);
  });

  it("子から8個広げても、親の近くに等間隔で並ぶ", () => {
    const parent = { x: radiusFor("comfortable"), y: 0 };
    const points = placeChildren({
      parent,
      count: 8,
      existing: [{ x: 0, y: 0 }, parent],
      awayFrom: { x: 0, y: 0 },
      density: "comfortable",
      parentDepth: 1,
    });
    const gap = minNodeGap("comfortable");
    expect(points).toHaveLength(8);
    expect(hasOverlap([{ x: 0, y: 0 }, parent, ...points], gap * 0.92)).toBe(false);
    const radii = points.map((point) => Math.hypot(point.x - parent.x, point.y - parent.y));
    const minR = Math.min(...radii);
    const maxR = Math.max(...radii);
    expect(maxR).toBeLessThan(gap * 2.4);
    expect(minR).toBeGreaterThan(gap * 0.55);
    const inner = radii.filter((radius) => radius < (minR + maxR) / 2);
    const outer = radii.filter((radius) => radius >= (minR + maxR) / 2);
    expect(inner.length).toBeGreaterThanOrEqual(2);
    expect(outer.length).toBeGreaterThanOrEqual(2);
    const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
    expect(spread(inner)).toBeLessThan(gap * 0.2);
    expect(spread(outer)).toBeLessThan(gap * 0.2);
  });
});

describe("展開のやり直し", () => {
  it("一つ戻ると、その展開のノード・辺・付箋が残らない", () => {
    let board = ops.createRootBoard(emptyBoard("test"), "根");
    const rootId = board.nodes[0]!.id;
    const started = ops.beginExpand(board, rootId, 8)!;
    board = ops.fillExpand(started.board, rootId, started.childIds, ["A", "B", "C", "D", "E", "F", "G", "H"]);
    board = ops.setMemo(board, started.childIds[0]!, "話したいエピソード");
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
    let board = ops.createRootBoard(emptyBoard("test"), "根");
    const rootId = board.nodes[0]!.id;
    const first = ops.beginExpand(board, rootId, 4)!;
    board = ops.fillExpand(first.board, rootId, first.childIds, ["春", "夏", "秋", "冬"]);
    const parentHistory: HistoryEntry = ops.historyFromChildren(board, rootId, first.childIds, first.edgeIds);

    const childId = first.childIds[1]!;
    const nested = ops.beginExpand(board, childId, 3)!;
    board = ops.fillExpand(nested.board, childId, nested.childIds, ["朝", "昼", "夜"]);
    board = ops.setMemo(board, nested.childIds[0]!, "孫のメモ");

    const undone = ops.undoExpand(board, parentHistory);
    expect(undone.nodes.map((node) => node.data.label)).toEqual(["根"]);
    expect(undone.edges).toHaveLength(0);
    expect(undone.nodes.some((node) => node.data.memo === "孫のメモ")).toBe(false);
  });

  it("AI待ちのプレースホルダも、戻ると消える", () => {
    const board = ops.createRootBoard(emptyBoard("test"), "根");
    const rootId = board.nodes[0]!.id;
    const started = ops.beginExpand(board, rootId, 6)!;
    const history = ops.historyFromChildren(started.board, rootId, started.childIds, started.edgeIds);
    const undone = ops.undoExpand(started.board, history);
    expect(undone.nodes).toHaveLength(1);
    expect(undone.edges).toHaveLength(0);

    const filledLate = ops.fillExpand(undone, rootId, started.childIds, ["残る話題"]);
    expect(filledLate.nodes).toHaveLength(1);
    expect(filledLate.nodes.some((node) => node.data.label === "残る話題")).toBe(false);
  });
});
