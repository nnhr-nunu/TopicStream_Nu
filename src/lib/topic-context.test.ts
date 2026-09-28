import { describe, expect, it } from "vitest";

import * as ops from "@/lib/board-ops";
import { normalizePrefs } from "@/lib/node-box";
import { emptyBoard } from "@/lib/storage";
import { rootLabel, topicContext } from "@/lib/topic-context";
import { anchorInstruction } from "@/lib/gemini-core";
import type { Board } from "@/lib/types";

const mandala = normalizePrefs({ generationLayout: "mandala" });

function expand(board: Board, parentId: string, labels: string[]): Board {
  const started = ops.beginExpand(board, parentId, labels.length, mandala)!;
  return ops.fillExpand(started.board, parentId, started.childIds, labels, mandala);
}

function idOf(board: Board, label: string): string {
  const node = board.nodes.find((item) => item.data.label === label && !item.data.copiedFromId);
  if (!node) throw new Error(label);
  return node.id;
}

describe("広げるカードの文脈", () => {
  it("祖先の文を近い順に返す（マンダラートの写しは元のマスとして数える）", () => {
    let board = ops.createRootBoard(emptyBoard("t"), "焼き鳥", mandala);
    board = expand(board, board.nodes[0]!.id, ["一番の失敗談", "B", "C", "D", "E", "F", "G", "H"]);
    board = expand(board, idOf(board, "一番の失敗談"), ["その瞬間どうした", "2", "3", "4", "5", "6", "7", "8"]);

    expect(topicContext(board, board.nodes[0]!.id)).toEqual([]);
    expect(topicContext(board, idOf(board, "一番の失敗談"))).toEqual(["焼き鳥"]);
    expect(topicContext(board, idOf(board, "その瞬間どうした"))).toEqual(["一番の失敗談", "焼き鳥"]);
  });

  it("深く広げても最初のお題（中心）を最後に付ける", () => {
    let board = ops.createRootBoard(emptyBoard("t"), "職場の人間関係", mandala);
    board = expand(board, board.nodes[0]!.id, ["上司との距離", "B", "C", "D", "E", "F", "G", "H"]);
    board = expand(board, idOf(board, "上司との距離"), ["報告のしかた", "2", "3", "4", "5", "6", "7", "8"]);
    board = expand(board, idOf(board, "報告のしかた"), ["朝いちの報告", "x2", "x3", "x4", "x5", "x6", "x7", "x8"]);
    board = expand(board, idOf(board, "朝いちの報告"), ["短く言う", "y2", "y3", "y4", "y5", "y6", "y7", "y8"]);

    expect(rootLabel(board, idOf(board, "短く言う"))).toBe("職場の人間関係");
    expect(rootLabel(board, board.nodes[0]!.id)).toBeUndefined();
    expect(topicContext(board, idOf(board, "短く言う"))).toEqual(["朝いちの報告", "報告のしかた", "上司との距離", "職場の人間関係"]);
    // 祖先が3つ以内なら中心はもう入っているので重ねない
    expect(topicContext(board, idOf(board, "朝いちの報告"))).toEqual(["報告のしかた", "上司との距離", "職場の人間関係"]);
  });

  it("中心に寄せる指示は雑談以外・2段目より深いときだけ", () => {
    const context = ["報告のしかた", "上司との距離", "職場の人間関係"];
    expect(anchorInstruction("advice", "朝いちの報告", context)).toContain("中心のお題「職場の人間関係」");
    expect(anchorInstruction("chat", "朝いちの報告", context)).toBe("");
    expect(anchorInstruction("advice", "上司との距離", ["職場の人間関係"])).toBe("");
  });
});
