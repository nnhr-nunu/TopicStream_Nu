import type { Board, TNode } from "@/lib/types";

/** 1回の展開で余分にもらう候補の数（「作り直す」をAPIなしで即座に出すため） */
export const SPARE_COUNT = 4;

/** 広げた子カードの親（予備の置き場）。マンダラートでは新しい3×3の中央。 */
export function spareHolderId(board: Board, childIds: string[], fallbackId: string): string {
  // マンダラートでは先頭の子が「中央の写し」（親＝クリックしたマス）なので、いちばん多い親を選ぶ
  const counts = new Map<string, number>();
  for (const node of board.nodes) {
    if (!childIds.includes(node.id) || !node.data.parentId) continue;
    counts.set(node.data.parentId, (counts.get(node.data.parentId) ?? 0) + 1);
  }
  let best = fallbackId;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

export function addSpares(board: Board, holderId: string, labels: string[]): Board {
  if (labels.length === 0) return board;
  const used = new Set(board.nodes.map((node) => node.data.label));
  return {
    ...board,
    nodes: board.nodes.map((node) => {
      if (node.id !== holderId) return node;
      const merged = [...(node.data.spares ?? [])];
      for (const label of labels) {
        if (!used.has(label) && !merged.includes(label)) merged.push(label);
      }
      return { ...node, data: { ...node.data, spares: merged.slice(0, 12) } };
    }),
  };
}

/** 盤面にまだ無い予備を1つ取り出す。無ければ label は null。 */
export function takeSpare(board: Board, holderId: string): { board: Board; label: string | null } {
  const holder = board.nodes.find((node) => node.id === holderId);
  const used = new Set(board.nodes.map((node) => node.data.label));
  const spares = holder?.data.spares ?? [];
  const index = spares.findIndex((label) => !used.has(label));
  if (!holder || index < 0) return { board, label: null };
  const label = spares[index]!;
  const rest = spares.slice(index + 1);
  return {
    board: {
      ...board,
      nodes: board.nodes.map((node: TNode) =>
        node.id === holderId ? { ...node, data: { ...node.data, spares: rest.length ? rest : undefined } } : node,
      ),
    },
    label,
  };
}

export function spareCount(board: Board, holderId: string | null | undefined): number {
  if (!holderId) return 0;
  const holder = board.nodes.find((node) => node.id === holderId);
  const used = new Set(board.nodes.map((node) => node.data.label));
  return (holder?.data.spares ?? []).filter((label) => !used.has(label)).length;
}
