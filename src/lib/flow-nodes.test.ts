import { describe, expect, it } from "vitest";

import { toFlowNodes, type TopicFlowNode } from "@/lib/flow-nodes";
import { cellCode } from "@/lib/mandala-ids";
import type { Board, TNode, TopicNodeData } from "@/lib/types";

function card(id: string, label: string, data: Partial<TopicNodeData> = {}, x = 0): TNode {
  return {
    id,
    position: { x, y: 0 },
    data: { label, memo: "", parentId: null, expanded: false, expanding: false, depth: 0, appearIndex: 0, ...data },
  };
}

function board(nodes: TNode[], focusedNodeId: string | null = null): Board {
  return { id: "board_1", name: "ボード", createdAt: 0, updatedAt: 0, nodes, edges: [], pinnedNodeId: null, focusedNodeId };
}

/** マンダラートの真ん中（お題）と、AI の語を待つ空のカード 2 枚 */
const before = board([
  card("a", "お題", { groupId: 1, cellIndex: 4 }),
  card("b", "", { placeholder: true, parentId: "a", groupId: 1, cellIndex: 0 }, 200),
  card("c", "", { placeholder: true, parentId: "a", groupId: 1, cellIndex: 1 }, 400),
]);
/** b に語が入り、空のカード d が増えたあと */
const after = board([
  card("a", "お題", { groupId: 1, cellIndex: 4 }),
  card("b", "猫", { parentId: "a", groupId: 1, cellIndex: 0 }, 200),
  card("c", "", { placeholder: true, parentId: "a", groupId: 1, cellIndex: 1 }, 400),
  card("d", "", { placeholder: true, parentId: "a", groupId: 1, cellIndex: 2 }, 600),
]);

describe("toFlowNodes", () => {
  it("盤面のカードを React Flow のノードにする（選んだカード・空のカードは動かせない・開いた先のコード）", () => {
    const opened = card("e", "猫", { copiedFromId: "b", groupId: 2, cellIndex: 4 }, 800);
    const nodes = toFlowNodes(board([...after.nodes, opened], "b"), true);
    expect(nodes.map(({ id, type, selected, draggable }) => ({ id, type, selected, draggable }))).toEqual([
      { id: "a", type: "topic", selected: false, draggable: true },
      { id: "b", type: "topic", selected: true, draggable: true },
      { id: "c", type: "topic", selected: false, draggable: false },
      { id: "d", type: "topic", selected: false, draggable: false },
      { id: "e", type: "topic", selected: false, draggable: true },
    ]);
    expect(nodes[1]!.data).toEqual({ ...after.nodes[1]!.data, openedCode: cellCode(2, 4) });
    expect(nodes[4]!.position).toEqual({ x: 800, y: 0 });
    expect(toFlowNodes(after, false).some((node) => node.draggable)).toBe(false);
  });

  it("今のノードを渡すと、同じ id のカードが測った大きさ（measured）を引き継ぐ（まだ測れていない・新しいカードには付けない）", () => {
    const current: TopicFlowNode[] = toFlowNodes(before, true).map((node) =>
      node.id === "c" ? node : { ...node, measured: { width: 184, height: 84 } },
    );
    expect(toFlowNodes(after, true, current).map((node) => node.measured)).toEqual([
      { width: 184, height: 84 },
      { width: 184, height: 84 },
      undefined,
      undefined,
    ]);
  });

  it("引き継ぐのは measured だけで、ほかの値（位置・選択・ドラッグ中・見た目のクラス）は盤面から作り直す", () => {
    const size = { width: 184, height: 84 };
    const current: TopicFlowNode[] = toFlowNodes(before, true).map((node) => ({
      ...node,
      position: { x: 999, y: 999 },
      selected: true,
      dragging: true,
      className: "combine-return",
      measured: size,
    }));
    expect(toFlowNodes(after, false, current)).toEqual(
      toFlowNodes(after, false).map((node) => (node.id === "d" ? node : { ...node, measured: size })),
    );
  });
});
