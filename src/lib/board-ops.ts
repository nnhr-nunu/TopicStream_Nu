import { CHILD_COUNT, MEMO_MAX, ROOT_LABEL_MAX } from "@/lib/constants";
import { createId } from "@/lib/ids";
import { bboxCenter, layoutBoard, radiusFor } from "@/lib/layout";
import { normalizePrefs } from "@/lib/node-box";
import type { Board, Density, HistoryEntry, LayoutPrefs, TEdge, TNode } from "@/lib/types";

function touch(board: Board, patch: Partial<Board>): Board {
  return { ...board, ...patch, updatedAt: Date.now() };
}

function cloneNode(node: TNode): TNode {
  return {
    ...node,
    position: { ...node.position },
    data: { ...node.data },
  };
}

function cloneEdge(edge: TEdge): TEdge {
  return { ...edge };
}

function applyLayout(board: Board, densityOrPrefs?: Density | LayoutPrefs, overlay = false): Board {
  return layoutBoard(board, densityOrPrefs, overlay);
}

export function createRootBoard(
  board: Board,
  label: string,
  densityOrPrefs: Density | LayoutPrefs = "comfortable",
  overlay = false,
): Board {
  const trimmed = label.trim().slice(0, ROOT_LABEL_MAX);
  const node: TNode = {
    id: createId("n"),
    position: { x: 0, y: 0 },
    data: {
      label: trimmed,
      memo: "",
      parentId: null,
      expanded: false,
      expanding: false,
      depth: 0,
      appearIndex: 0,
    },
  };
  return applyLayout(
    touch(board, {
      nodes: [node],
      edges: [],
      focusedNodeId: node.id,
      pinnedNodeId: node.id,
    }),
    densityOrPrefs,
    overlay,
  );
}

export function addRootNode(
  board: Board,
  label: string,
  densityOrPrefs: Density | LayoutPrefs = "comfortable",
  overlay = false,
): Board {
  const prefs = normalizePrefs(densityOrPrefs, overlay);
  const existing = board.nodes.map((node) => node.position);
  const center = bboxCenter(existing);
  const node: TNode = {
    id: createId("n"),
    position: existing.length === 0 ? { x: 0, y: 0 } : { x: center.x + radiusFor(prefs.density, prefs.overlay) * 2.05, y: center.y },
    data: {
      label: label.trim().slice(0, ROOT_LABEL_MAX),
      memo: "",
      parentId: null,
      expanded: false,
      expanding: false,
      depth: 0,
      appearIndex: 0,
    },
  };
  return applyLayout(
    touch(board, {
      nodes: [...board.nodes, node],
      focusedNodeId: node.id,
    }),
    densityOrPrefs,
    overlay,
  );
}

export function beginExpand(
  board: Board,
  parentId: string,
  count = CHILD_COUNT,
  densityOrPrefs: Density | LayoutPrefs = "comfortable",
  overlay = false,
): { board: Board; childIds: string[]; edgeIds: string[] } | null {
  const parent = board.nodes.find((node) => node.id === parentId);
  if (!parent || parent.data.expanding) return null;

  const existingChildren = board.nodes.filter((node) => node.data.parentId === parentId).length;

  const children: TNode[] = Array.from({ length: count }, (_, index) => ({
    id: createId("n"),
    position: { ...parent.position },
    data: {
      label: "…",
      memo: "",
      parentId,
      expanded: false,
      expanding: false,
      placeholder: true,
      depth: parent.data.depth + 1,
      appearIndex: existingChildren + index,
      sproutX: 0,
      sproutY: 0,
    },
  }));
  const edges: TEdge[] = children.map((child) => ({
    id: createId("e"),
    source: parentId,
    target: child.id,
  }));
  const childIds = children.map((child) => child.id);
  const edgeIds = edges.map((edge) => edge.id);

  const next = applyLayout(
    touch(board, {
      nodes: board.nodes
        .map((node) =>
          node.id === parentId
            ? { ...node, data: { ...node.data, expanding: true, expanded: true } }
            : node,
        )
        .concat(children),
      edges: [...board.edges, ...edges],
      focusedNodeId: parentId,
    }),
    densityOrPrefs,
    overlay,
  );

  const parentPos = next.nodes.find((node) => node.id === parentId)?.position ?? parent.position;
  return {
    board: {
      ...next,
      nodes: next.nodes.map((node) => {
        if (!childIds.includes(node.id)) return node;
        return {
          ...node,
          data: {
            ...node.data,
            sproutX: parentPos.x - node.position.x,
            sproutY: parentPos.y - node.position.y,
          },
        };
      }),
    },
    childIds,
    edgeIds,
  };
}

export function fillExpand(
  board: Board,
  parentId: string,
  childIds: string[],
  labels: string[],
  densityOrPrefs: Density | LayoutPrefs = "comfortable",
  overlay = false,
): Board {
  const present = childIds.filter((id) => board.nodes.some((node) => node.id === id));
  if (present.length === 0) {
    return touch(board, {
      nodes: board.nodes.map((node) =>
        node.id === parentId ? { ...node, data: { ...node.data, expanding: false } } : node,
      ),
    });
  }
  return applyLayout(
    touch(board, {
      nodes: board.nodes.map((node) => {
        if (node.id === parentId) {
          return { ...node, data: { ...node.data, expanding: false, expanded: true, placeholder: false } };
        }
        const index = childIds.indexOf(node.id);
        if (index === -1) return node;
        const label = labels[index] ?? `話題 ${index + 1}`;
        return {
          ...node,
          data: {
            ...node.data,
            label,
            placeholder: false,
            expanding: false,
          },
        };
      }),
    }),
    densityOrPrefs,
    overlay,
  );
}

export function failExpand(board: Board, parentId: string, childIds: string[], edgeIds: string[]): Board {
  const dropNodes = new Set(childIds);
  const dropEdges = new Set(edgeIds);
  return touch(board, {
    nodes: board.nodes
      .filter((node) => !dropNodes.has(node.id))
      .map((node) =>
        node.id === parentId ? { ...node, data: { ...node.data, expanding: false } } : node,
      ),
    edges: board.edges.filter((edge) => !dropEdges.has(edge.id)),
  });
}

export function collectDescendants(board: Board, roots: string[]): Set<string> {
  const ids = new Set(roots);
  let grew = true;
  while (grew) {
    grew = false;
    for (const node of board.nodes) {
      if (node.data.parentId && ids.has(node.data.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        grew = true;
      }
    }
  }
  return ids;
}

export function undoExpand(board: Board, action: HistoryEntry): Board {
  const drop = collectDescendants(board, action.childIds);
  for (const node of action.nodes) drop.add(node.id);
  const remaining = board.nodes.filter((node) => !drop.has(node.id));
  const remainingIds = new Set(remaining.map((node) => node.id));
  const dropEdges = new Set(action.edgeIds);
  return touch(board, {
    nodes: remaining.map((node) =>
      node.id === action.parentId
        ? {
            ...node,
            data: {
              ...node.data,
              expanded: remaining.some((child) => child.data.parentId === action.parentId),
              expanding: false,
            },
          }
        : node,
    ),
    edges: board.edges.filter(
      (edge) =>
        remainingIds.has(edge.source) &&
        remainingIds.has(edge.target) &&
        !dropEdges.has(edge.id),
    ),
    pinnedNodeId: board.pinnedNodeId && drop.has(board.pinnedNodeId) ? action.parentId : board.pinnedNodeId,
    focusedNodeId: action.parentId,
  });
}

export function captureSubtree(board: Board, childIds: string[]): { nodes: TNode[]; edges: TEdge[] } {
  const drop = collectDescendants(board, childIds);
  return {
    nodes: board.nodes.filter((node) => drop.has(node.id)).map(cloneNode),
    edges: board.edges.filter((edge) => drop.has(edge.source) || drop.has(edge.target)).map(cloneEdge),
  };
}

export function historyFromChildren(board: Board, parentId: string, childIds: string[], edgeIds: string[]): HistoryEntry {
  const captured = captureSubtree(board, childIds);
  const edgeSet = new Set(edgeIds);
  const extraEdges = captured.edges.filter((edge) => !edgeSet.has(edge.id));
  return {
    parentId,
    childIds: [...childIds],
    edgeIds: [...edgeIds, ...extraEdges.map((edge) => edge.id)],
    nodes: captured.nodes,
    edges: captured.edges,
  };
}

export function redoExpand(board: Board, entry: HistoryEntry): Board {
  const existing = new Set(board.nodes.map((node) => node.id));
  const nodes = [
    ...board.nodes.map((node) =>
      node.id === entry.parentId ? { ...node, data: { ...node.data, expanded: true, expanding: false } } : node,
    ),
    ...entry.nodes.filter((node) => !existing.has(node.id)).map(cloneNode),
  ];
  const edgeIds = new Set(board.edges.map((edge) => edge.id));
  return touch(board, {
    nodes,
    edges: [...board.edges, ...entry.edges.filter((edge) => !edgeIds.has(edge.id)).map(cloneEdge)],
    focusedNodeId: entry.parentId,
  });
}

export function clearChildren(board: Board, parentId: string): { board: Board; history: HistoryEntry | null } {
  const childIds = board.nodes.filter((node) => node.data.parentId === parentId).map((node) => node.id);
  if (childIds.length === 0) return { board, history: null };
  const edgeIds = board.edges.filter((edge) => edge.source === parentId && childIds.includes(edge.target)).map((edge) => edge.id);
  const history = historyFromChildren(board, parentId, childIds, edgeIds);
  return { board: undoExpand(board, history), history };
}

export function setMemo(
  board: Board,
  nodeId: string,
  memo: string,
  densityOrPrefs: Density | LayoutPrefs = "comfortable",
  overlay = false,
): Board {
  return applyLayout(
    touch(board, {
      nodes: board.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, memo: memo.slice(0, MEMO_MAX) } } : node,
      ),
    }),
    densityOrPrefs,
    overlay,
  );
}

export function pinNode(
  board: Board,
  nodeId: string | null,
  densityOrPrefs: Density | LayoutPrefs = "comfortable",
  overlay = false,
): Board {
  const nextId = nodeId && board.pinnedNodeId === nodeId ? null : nodeId;
  const prefs = normalizePrefs(densityOrPrefs, overlay);
  return applyLayout(
    touch(board, {
      pinnedNodeId: nextId,
    }),
    { ...prefs, pinnedNodeId: nextId },
    overlay,
  );
}

export function focusNode(board: Board, nodeId: string | null): Board {
  return touch(board, { focusedNodeId: nodeId });
}

export function renameBoard(board: Board, name: string): Board {
  const trimmed = name.trim();
  return touch(board, { name: trimmed || board.name });
}

export function syncPositions(board: Board, positions: Record<string, { x: number; y: number }>): Board {
  let changed = false;
  const nodes = board.nodes.map((node) => {
    const next = positions[node.id];
    if (!next) return node;
    if (next.x === node.position.x && next.y === node.position.y) return node;
    changed = true;
    return { ...node, position: next };
  });
  return changed ? touch(board, { nodes }) : board;
}
