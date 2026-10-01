import { describe, expect, it } from "vitest";

import * as ops from "@/lib/board-ops";
import { normalizePrefs } from "@/lib/node-box";
import { clearTalked, hasTalked, pickWeighted, rouletteCandidates, spinSequence } from "@/lib/roulette";
import { emptyBoard } from "@/lib/storage";
import type { Board } from "@/lib/types";

const prefs = normalizePrefs({ generationLayout: "mandala" });

function expandedBoard(): Board {
  const board = ops.createRootBoard(emptyBoard("test"), "最近買ってよかったもの", prefs);
  const rootId = board.nodes[0]!.id;
  const started = ops.beginExpand(board, rootId, 8, prefs)!;
  return ops.fillExpand(started.board, rootId, started.childIds, ["A", "B", "C", "D", "E", "F", "G", "H"], prefs);
}

describe("話題ルーレット", () => {
  it("最初のお題・いま話しているカード・話したカードは選ばない", () => {
    let board = expandedBoard();
    const a = board.nodes.find((node) => node.data.label === "A")!.id;
    const b = board.nodes.find((node) => node.data.label === "B")!.id;
    board = ops.pinNode(board, a, prefs);
    // A から B へ移すと、A は話し終えた印が付く
    board = ops.pinNode(board, b, prefs);
    expect(board.nodes.find((node) => node.id === a)?.data.talkedAt).toBeTypeOf("number");
    expect(board.pinnedAt).toBeTypeOf("number");
    const labels = rouletteCandidates(board).map((node) => node.data.label).sort();
    expect(labels).toEqual(["C", "D", "E", "F", "G", "H"]);
  });

  it("話した印を全部外すと、また選べる", () => {
    let board = expandedBoard();
    for (const label of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
      board = ops.pinNode(board, board.nodes.find((node) => node.data.label === label)!.id, prefs);
    }
    board = ops.pinNode(board, null, prefs);
    expect(rouletteCandidates(board)).toEqual([]);
    expect(hasTalked(board)).toBe(true);
    const cleared = clearTalked({ ...board, updatedAt: 1 });
    expect(hasTalked(cleared)).toBe(false);
    expect(cleared.updatedAt).toBeGreaterThan(1);
    expect(rouletteCandidates(cleared).map((node) => node.data.label).sort()).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
    // 印が無ければ同じボードを返す（保存し直さない）
    expect(clearTalked(cleared)).toBe(cleared);
  });

  it("文を書き直したカードは、また選べる", () => {
    let board = expandedBoard();
    const a = board.nodes.find((node) => node.data.label === "A")!.id;
    board = ops.pinNode(ops.pinNode(board, a, prefs), null, prefs);
    expect(rouletteCandidates(board).some((node) => node.id === a)).toBe(false);
    board = ops.setLabel(board, a, "A'", prefs);
    expect(rouletteCandidates(board).some((node) => node.id === a)).toBe(true);
  });

  it("ハートの多いカードほど当たりやすい", () => {
    let board = expandedBoard();
    const hot = board.nodes.find((node) => node.data.label === "C")!.id;
    board = ops.bumpFrameHearts(board, hot, 20);
    const candidates = rouletteCandidates(board);
    let hits = 0;
    let seed = 1;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 400; i += 1) if (pickWeighted(candidates, random)?.id === hot) hits += 1;
    // 重み 21 / (21 + 7) ≒ 75%
    expect(hits).toBeGreaterThan(240);
  });

  it("光らせる順の最後が当たりで、だんだんゆっくりになる", () => {
    const board = expandedBoard();
    const candidates = rouletteCandidates(board);
    const winner = candidates[3]!;
    const steps = spinSequence(candidates, winner);
    expect(steps.at(-1)?.id).toBe(winner.id);
    expect(steps.at(-2)?.id).not.toBe(winner.id);
    expect(steps[0]!.delay).toBeLessThan(steps.at(-2)!.delay);
    expect(spinSequence([winner], winner)).toEqual([{ id: winner.id, delay: 0 }]);
  });
});
