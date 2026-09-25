import { describe, expect, it } from "vitest";

import { isWellUsed, rankCommunityBoards, toCommunityBoard, type CommunityBoard } from "@/lib/community-boards";
import type { Board, TNode } from "@/lib/types";

function card(id: string, label: string, parentId: string | null, expanded = false, memo = ""): TNode {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { label, memo, parentId, expanded, expanding: false, depth: parentId ? 1 : 0, appearIndex: 0 },
  };
}

function board(opts: { root: string; openChild?: boolean; name?: string; label?: string }): Board {
  const nodes = [card("r", opts.root, null, true, "ルートのメモ")];
  for (let index = 0; index < 8; index += 1) {
    nodes.push(card(`c${index}`, index === 0 && opts.label ? opts.label : `話題${index}`, "r", index === 0 && opts.openChild));
  }
  if (opts.openChild) {
    for (let index = 0; index < 8; index += 1) nodes.push(card(`g${index}`, `孫${index}`, "c0"));
  }
  return {
    id: "board_local",
    name: opts.name ?? "9月25日の雑談",
    createdAt: 0,
    updatedAt: 0,
    nodes,
    edges: nodes.filter((node) => node.data.parentId).map((node) => ({ id: `e_${node.id}`, source: node.data.parentId!, target: node.id })),
    pinnedNodeId: null,
    focusedNodeId: null,
  };
}

describe("みんなのトークテーマ", () => {
  it("最初の8枚だけのボードは載せず、もう一歩広げたら載せる", () => {
    expect(isWellUsed(board({ root: "休日" }))).toBe(false);
    expect(isWellUsed(board({ root: "休日", openChild: true }))).toBe(true);
  });

  it("メモを外し、日付だけの名前はお題の名前にする", () => {
    const entry = toCommunityBoard(board({ root: "休日の過ごし方", openChild: true }), "cb_1", 1000);
    expect(entry?.name).toBe("休日の過ごし方");
    expect(entry?.nodes.every((node) => node.data.memo === "")).toBe(true);
    expect(entry?.opened).toBe(1);
  });

  it("URL や連絡先を含むボードは載せない", () => {
    const entry = toCommunityBoard(board({ root: "休日", openChild: true, label: "090-1234-5678" }), "cb_1");
    expect(entry).toBeNull();
  });

  it("よく使われた新しいボードを上に、同じお題は1枚にまとめる", () => {
    const now = Date.parse("2026-09-25T12:00:00Z");
    const make = (id: string, root: string, opened: number, hoursAgo: number): CommunityBoard => ({
      id,
      name: root,
      root,
      nodes: [],
      edges: [],
      cards: 9 + opened * 8,
      opened,
      hearts: 0,
      updatedAt: now - hoursAgo * 3_600_000,
    });
    const ranked = rankCommunityBoards(
      [make("a", "ゲーム", 1, 1), make("b", "ご飯", 4, 2), make("c", "ゲーム", 3, 1), make("d", "昔の話", 6, 24 * 20)],
      {},
      now,
    );
    expect(ranked.map((item) => item.id)).toEqual(["b", "c", "d"]);
  });
});
