import { describe, expect, it } from "vitest";

import * as ops from "@/lib/board-ops";
import { normalizePrefs } from "@/lib/node-box";
import { emptyBoard } from "@/lib/storage";
import { topicContext } from "@/lib/topic-context";
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
});
