import { describe, expect, it } from "vitest";

import { asBoard, parseImportedBoards } from "@/lib/storage";
import type { TNode } from "@/lib/types";

function node(id: string, parentId: string | null, data: Partial<TNode["data"]> = {}): TNode {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { label: id, memo: "", parentId, expanded: false, expanding: false, depth: 0, appearIndex: 0, ...data },
  };
}

describe("書き出した JSON の読み込み", () => {
  it("使えるボードが無いファイルは null（今のボードを消さない）", () => {
    expect(parseImportedBoards({})).toBeNull();
    expect(parseImportedBoards([])).toBeNull();
    expect(parseImportedBoards({ boards: [{ nope: 1 }] })).toBeNull();
    expect(parseImportedBoards(null)).toBeNull();
  });

  it("ボードがあれば読み込む", () => {
    const boards = parseImportedBoards({ boards: [{ id: "b1", name: "雑談", nodes: [node("r", null)], edges: [] }] });
    expect(boards?.map((board) => board.id)).toEqual(["b1"]);
  });
});

describe("広げている途中で閉じたボード", () => {
  it("中身の無い 3×3 の中央（写し）を外し、元のカードをもう一度広げられるようにする", () => {
    const board = asBoard({
      id: "b1",
      name: "雑談",
      nodes: [
        node("root", null, { expanded: true }),
        node("a", "root"),
        node("b", "root", { expanded: true }),
        node("copy", "b", { expanded: true, copiedFromId: "b" }),
        // 空のカード（…）は保存されないので、写しの下は空になっている
        node("p", "copy", { placeholder: true }),
      ],
      edges: [{ id: "e1", source: "b", target: "copy" }],
    });
    expect(board?.nodes.map((item) => item.id)).toEqual(["root", "a", "b"]);
    expect(board?.nodes.find((item) => item.id === "b")?.data.expanded).toBe(false);
    expect(board?.nodes.find((item) => item.id === "root")?.data.expanded).toBe(true);
    expect(board?.edges).toEqual([]);
  });

  it("「具体的にする」の答えの印を読み込み直しても残す", () => {
    const board = asBoard({ id: "b1", name: "x", nodes: [node("r", null), node("d", "r", { detail: true })], edges: [] });
    expect(board?.nodes.find((item) => item.id === "d")?.data.detail).toBe(true);
  });

  it("お題箱から採用したカードの印（リスナーのお題）を読み込み直しても残す", () => {
    const board = asBoard({ id: "b1", name: "x", nodes: [node("r", null, { fromListener: true }), node("a", "r")], edges: [] });
    expect(board?.nodes.find((item) => item.id === "r")?.data.fromListener).toBe(true);
    expect(board?.nodes.find((item) => item.id === "a")?.data.fromListener).toBeUndefined();
  });
});
