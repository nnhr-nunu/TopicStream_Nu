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
  // 深く広げても最初のお題（中心）は必ず最後に付ける。近い祖先だけだと、深くなるほど中心から話がズレていく
  const root = rootLabel(board, nodeId);
  if (root && labels.length >= depth && labels[labels.length - 1] !== root) labels.push(root);
  return labels;
}

/** そのカードが属するボードの最初のお題（親をたどった先）。カード自身が中心なら undefined */
export function rootLabel(board: Board, nodeId: string): string | undefined {
  const byId = new Map(board.nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  let current = byId.get(nodeId);
  if (!current || current.data.parentId === null) return undefined;
  while (current && current.data.parentId !== null && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.data.parentId);
  }
  return current?.data.parentId === null ? current.data.label.trim() || undefined : undefined;
}
