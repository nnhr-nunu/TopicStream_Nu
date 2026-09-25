import type { Board } from "@/lib/types";

/** 文脈として渡す祖先の数（近い順）。遠いお題ほど効かないので少なめ */
const CONTEXT_DEPTH = 3;

/**
 * カードの祖先の文（近い順）。マンダラートの写し（copiedFromId）は元のマスとして数える。
 * 「一番の失敗談」のような汎用の切り口を広げるとき、何の話の失敗談なのかを生成に渡すために使う。
 */
export function topicContext(board: Board, nodeId: string, depth = CONTEXT_DEPTH): string[] {
  const byId = new Map(board.nodes.map((node) => [node.id, node]));
  const resolve = (id: string | null | undefined) => {
    const node = id ? byId.get(id) : undefined;
    const original = node?.data.copiedFromId ? byId.get(node.data.copiedFromId) : undefined;
    return original ?? node;
  };
  const labels: string[] = [];
  const seen = new Set<string>();
  let current = resolve(nodeId);
  while (current && labels.length < depth) {
    seen.add(current.id);
    const parent = resolve(current.data.parentId);
    if (!parent || seen.has(parent.id)) break;
    const label = parent.data.label.trim();
    if (label && !parent.data.placeholder) labels.push(label);
    current = parent;
  }
  return labels;
}
