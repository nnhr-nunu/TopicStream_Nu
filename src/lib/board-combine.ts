import { mixLabel } from "@/lib/combine";
import { createId } from "@/lib/ids";
import { layoutBoard } from "@/lib/layout";
import { CENTER_CELL_INDEX, familyIndexForGroup, nextGroupId } from "@/lib/mandala-ids";
import { normalizePrefs } from "@/lib/node-box";
import type { Board, Density, LayoutPrefs, TEdge, TNode } from "@/lib/types";

export type CombineCheck = { ok: true } | { ok: false; reason: string };

/** 掛け合わせられるか（どちらも中身のあるカードで、同じ組み合わせをまだ作っていない） */
export function canCombine(board: Board, sourceId: string, targetId: string): CombineCheck {
  if (sourceId === targetId) return { ok: false, reason: "同じカードどうしは掛け合わせられません" };
  const source = board.nodes.find((node) => node.id === sourceId);
  const target = board.nodes.find((node) => node.id === targetId);
  if (!source || !target) return { ok: false, reason: "カードが見つかりません" };
  if (source.data.placeholder || target.data.placeholder) return { ok: false, reason: "話題を準備中のカードです" };
  if (target.data.expanding) return { ok: false, reason: "広げている途中のカードです" };
  if (source.data.label.trim() === target.data.label.trim()) {
    return { ok: false, reason: "同じ文のカードどうしは掛け合わせられません" };
  }
  if (existingMix(board, sourceId, targetId)) return { ok: false, reason: "この 2 枚はもう掛け合わせてあります" };
  return { ok: true };
}

/** 同じ 2 枚（向きは問わない）で作った掛け合わせのカード */
export function existingMix(board: Board, sourceId: string, targetId: string): TNode | undefined {
  return board.nodes.find(
    (node) =>
      (node.data.parentId === targetId && node.data.mixedFromId === sourceId) ||
      (node.data.parentId === sourceId && node.data.mixedFromId === targetId),
  );
}

/**
 * 重ねた先（target）の子として「target × source」のカードを置き、両方から線を引く。
 * マンダラートでは新しい 3×3 の中央にする。周りの 8 枚は、このあとふつうに広げて埋める。
 */
export function addMixNode(
  board: Board,
  sourceId: string,
  targetId: string,
  densityOrPrefs: Density | LayoutPrefs = "comfortable",
  overlay = false,
): { board: Board; mixId: string; edgeIds: string[] } | null {
  if (!canCombine(board, sourceId, targetId).ok) return null;
  const source = board.nodes.find((node) => node.id === sourceId)!;
  const target = board.nodes.find((node) => node.id === targetId)!;
  const mandala = normalizePrefs(densityOrPrefs, overlay).generationLayout === "mandala";
  const groupId = mandala ? nextGroupId(board.nodes) : undefined;
  const mix: TNode = {
    id: createId("n"),
    position: { ...target.position },
    data: {
      label: mixLabel(target.data.label, source.data.label),
      memo: "",
      parentId: target.id,
      expanded: false,
      expanding: false,
      depth: target.data.depth + 1,
      appearIndex: 0,
      sproutX: 0,
      sproutY: 0,
      mixedFromId: source.id,
      ...(typeof groupId === "number"
        ? {
            groupId,
            cellIndex: CENTER_CELL_INDEX,
            familyIndex: familyIndexForGroup(groupId),
            role: "source" as const,
          }
        : {}),
    },
  };
  const edges: TEdge[] = [
    { id: createId("e"), source: target.id, target: mix.id },
    { id: createId("e"), source: source.id, target: mix.id },
  ];
  const next = layoutBoard(
    {
      ...board,
      nodes: [...board.nodes, mix],
      edges: [...board.edges, ...edges],
      focusedNodeId: mix.id,
      updatedAt: Date.now(),
    },
    densityOrPrefs,
    overlay,
  );
  return { board: next, mixId: mix.id, edgeIds: edges.map((edge) => edge.id) };
}
