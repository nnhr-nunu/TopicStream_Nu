import { describe, expect, it } from "vitest";

import * as ops from "@/lib/board-ops";
import { normalizePrefs } from "@/lib/node-box";
import { emptyBoard } from "@/lib/storage";
import { buildTopicTrail, type TrailNode } from "@/lib/topic-trail";
import type { Board } from "@/lib/types";

const mandala = normalizePrefs({ generationLayout: "mandala" });
const radial = normalizePrefs({ generationLayout: "radial", density: "comfortable" });

function expand(board: Board, parentId: string, labels: string[], prefs = mandala): Board {
  const started = ops.beginExpand(board, parentId, labels.length, prefs)!;
  return ops.fillExpand(started.board, parentId, started.childIds, labels, prefs);
}

function idOf(board: Board, label: string): string {
  const node = board.nodes.find((item) => item.data.label === label && !item.data.copiedFromId);
  if (!node) throw new Error(label);
  return node.id;
}

function outline(node: TrailNode): string {
  const kids = node.children.map(outline).join(",");
  return `${node.label}${node.step ? `#${node.step}` : ""}${kids ? `(${kids})` : ""}`;
}

const EIGHT = ["A", "B", "C", "D", "E", "F", "G", "H"];

describe("話題の軌跡", () => {
  it("広げた話題だけを、広げた順の番号付きでたどる（マンダラートの写しは元のマスにまとめる）", () => {
    let board = ops.createRootBoard(emptyBoard("t"), "夏休み", mandala);
    board = expand(board, board.nodes[0]!.id, EIGHT);
    board = expand(board, idOf(board, "C"), ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"]);
    board = expand(board, idOf(board, "C5"), ["X1", "X2", "X3", "X4", "X5", "X6", "X7", "X8"]);
    board = expand(board, idOf(board, "A"), ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"]);

    const trail = buildTopicTrail(board);
    expect(trail.steps).toBe(4);
    expect(trail.roots.map(outline)).toEqual(["夏休み#1(C#2(C5#3),A#4)"]);
  });

  it("ピンやハートを付けた話題は、広げていなくても道ごと残す", () => {
    let board = ops.createRootBoard(emptyBoard("t"), "夏休み", radial);
    board = expand(board, board.nodes[0]!.id, ["海", "花火", "宿題"], radial);
    board = ops.toggleHeart(board, idOf(board, "花火"));
    board = ops.pinNode(board, idOf(board, "宿題"), radial);

    const trail = buildTopicTrail(board);
    expect(trail.roots.map(outline)).toEqual(["夏休み#1(花火,宿題)"]);
    const [fireworks, homework] = trail.roots[0]!.children;
    expect(fireworks!.hearts).toBe(1);
    expect(homework!.pinned).toBe(true);
    expect(trail.size).toBe(3);
  });

  it("まだ何も広げていなければ中心だけ", () => {
    const board = ops.createRootBoard(emptyBoard("t"), "夏休み", mandala);
    const trail = buildTopicTrail(board);
    expect(trail.steps).toBe(0);
    expect(trail.roots.map(outline)).toEqual(["夏休み"]);
  });
});
