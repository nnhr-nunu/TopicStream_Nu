import type { Node } from "@xyflow/react";

import { cellCode } from "@/lib/mandala-ids";
import type { Board, TopicNodeData } from "@/lib/types";

/** openedCode: マンダラートで開いた先の中央コード（画面表示用。保存しない） */
export type TopicFlowNode = Node<TopicNodeData & { openedCode?: string }, "topic">;

/** マンダラートで開いたマス → 開いた先の3×3の中央コード（例: 1F → 2E）。 */
function openedCodes(board: Board): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of board.nodes) {
    const from = node.data.copiedFromId;
    if (!from || typeof node.data.groupId !== "number" || typeof node.data.cellIndex !== "number") continue;
    const code = cellCode(node.data.groupId, node.data.cellIndex);
    if (code) map.set(from, code);
  }
  return map;
}

/**
 * draggable: PC で掛け合わせができるとき（スマホは長押ししてから動かすので、React Flow のドラッグは使わない）
 *
 * current（今のノード）を渡すと、同じ id のカードが測った大きさ（measured）だけを引き継ぐ。
 * measured の無いノードを渡すと、React Flow は作り直しとみなして全カードを測り直し、それまでカードを隠して線も描かない
 * （AI の語が 1 つ入るたびに起きていた）。語が入って大きさが変わったカードは、React Flow の ResizeObserver が測り直す
 */
export function toFlowNodes(board: Board, draggable: boolean, current?: readonly TopicFlowNode[]): TopicFlowNode[] {
  const opened = openedCodes(board);
  const measured = new Map(current?.map((node) => [node.id, node.measured] as const));
  return board.nodes.map((node) => {
    const size = measured.get(node.id);
    return {
      id: node.id,
      type: "topic",
      position: node.position,
      data: opened.has(node.id) ? { ...node.data, openedCode: opened.get(node.id) } : node.data,
      selected: board.focusedNodeId === node.id,
      draggable: draggable && !node.data.placeholder,
      ...(size ? { measured: size } : {}),
    };
  });
}
