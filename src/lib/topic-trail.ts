import { cellCode } from "@/lib/mandala-ids";
import type { Board, TNode } from "@/lib/types";

/**
 * 話題の軌跡: ボードから「選んだ話題」だけを抜き出した木。X 投稿用の画像に使う。
 *
 * 選んだ話題 = 中心のお題・広げた話題・ピンした話題・ハートが付いた話題（と、そこへ至る道）。
 * マンダラートで広げると新しい 3×3 の中央に同じ文の写し（copiedFromId）が置かれるので、
 * 写しは元のマスにまとめ、写しの下に広がった話題は元のマスの子として扱う。
 */
export type TrailNode = {
  id: string;
  label: string;
  /** マンダラートのマス番号（1E など）。放射では空 */
  code: string;
  familyIndex: number;
  depth: number;
  /** 何回目に広げた話題か（1 から）。広げていなければ null */
  step: number | null;
  pinned: boolean;
  hearts: number;
  children: TrailNode[];
};

export type TopicTrail = {
  roots: TrailNode[];
  /** 広げた回数 */
  steps: number;
  /** 木に入った話題の数 */
  size: number;
};

function heartsOf(node: TNode): number {
  return (node.data.heartCount ?? 0) + (node.data.frameHearts ?? 0);
}

export function buildTopicTrail(board: Board): TopicTrail {
  const byId = new Map(board.nodes.map((node) => [node.id, node]));
  const order = new Map(board.nodes.map((node, index) => [node.id, index]));
  const isCopy = (node: TNode) => Boolean(node.data.copiedFromId && byId.has(node.data.copiedFromId));
  const real = board.nodes.filter((node) => !node.data.placeholder && !isCopy(node));

  /** 写しを元のマスに置き換えた親 */
  const logicalParent = (node: TNode): string | null => {
    const parent = node.data.parentId ? byId.get(node.data.parentId) : undefined;
    if (!parent) return null;
    return isCopy(parent) ? parent.data.copiedFromId! : parent.id;
  };

  // 広げた順: その話題から生まれたカード（写しを含む）のうち、いちばん早く並んだものの位置
  const expandedAt = new Map<string, number>();
  for (const node of board.nodes) {
    const from = node.data.copiedFromId && byId.has(node.data.copiedFromId) ? node.data.copiedFromId : node.data.parentId;
    if (!from || node.data.placeholder) continue;
    const at = order.get(node.id) ?? 0;
    expandedAt.set(from, Math.min(expandedAt.get(from) ?? Infinity, at));
  }
  const hasChildren = new Set<string>();
  for (const node of real) {
    const parent = logicalParent(node);
    if (parent) hasChildren.add(parent);
  }
  const expanded = real.filter((node) => hasChildren.has(node.id) && expandedAt.has(node.id));
  expanded.sort((a, b) => expandedAt.get(a.id)! - expandedAt.get(b.id)!);
  const stepOf = new Map(expanded.map((node, index) => [node.id, index + 1]));

  const keep = new Set<string>();
  const markWithAncestors = (node: TNode | undefined) => {
    let current = node;
    while (current && !keep.has(current.id)) {
      keep.add(current.id);
      const parent = logicalParent(current);
      current = parent ? byId.get(parent) : undefined;
    }
  };
  for (const node of real) {
    if (
      node.data.parentId === null ||
      stepOf.has(node.id) ||
      board.pinnedNodeId === node.id ||
      heartsOf(node) > 0
    ) {
      markWithAncestors(node);
    }
  }

  const childrenOf = new Map<string, TNode[]>();
  const roots: TNode[] = [];
  for (const node of real) {
    if (!keep.has(node.id)) continue;
    const parent = logicalParent(node);
    if (parent && keep.has(parent)) {
      const list = childrenOf.get(parent) ?? [];
      list.push(node);
      childrenOf.set(parent, list);
    } else {
      roots.push(node);
    }
  }
  // 兄弟は広げた順、広げていない話題はその後ろに盤面の並び順で
  const rank = (node: TNode) => stepOf.get(node.id) ?? 10_000 + (order.get(node.id) ?? 0);

  let size = 0;
  const toTrail = (node: TNode, depth: number): TrailNode => {
    size += 1;
    const kids = [...(childrenOf.get(node.id) ?? [])].sort((a, b) => rank(a) - rank(b));
    return {
      id: node.id,
      label: node.data.label.trim() || "話題",
      code:
        typeof node.data.groupId === "number" && typeof node.data.cellIndex === "number"
          ? cellCode(node.data.groupId, node.data.cellIndex)
          : "",
      familyIndex: node.data.familyIndex ?? depth,
      depth,
      step: stepOf.get(node.id) ?? null,
      pinned: board.pinnedNodeId === node.id,
      hearts: heartsOf(node),
      children: kids.map((kid) => toTrail(kid, depth + 1)),
    };
  };

  return {
    roots: roots.sort((a, b) => rank(a) - rank(b)).map((root) => toTrail(root, 0)),
    steps: stepOf.size,
    size,
  };
}
