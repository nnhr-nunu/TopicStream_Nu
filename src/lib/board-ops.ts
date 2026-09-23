import { CHILD_COUNT, LABEL_EDIT_MAX, MEMO_MAX, ROOT_LABEL_MAX } from "@/lib/constants";
import { createId } from "@/lib/ids";
import { bboxCenter, layoutBoard, radiusFor } from "@/lib/layout";
import {
  CENTER_CELL_INDEX,
  familyIndexForGroup,
  KEYWORD_CELL_INDICES,
  nextGroupId,
  usedCellIndices,
} from "@/lib/mandala-ids";
import { normalizePrefs } from "@/lib/node-box";
import type { Board, Density, HistoryEntry, LayoutPrefs, TEdge, TNode, TopicNodeData } from "@/lib/types";

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

function skipLayout(densityOrPrefs?: Density | LayoutPrefs, overlay = false): boolean {
  return normalizePrefs(densityOrPrefs, overlay).generationLayout === "mandala";
}

function maybeLayout(board: Board, densityOrPrefs?: Density | LayoutPrefs, overlay = false): Board {
  if (skipLayout(densityOrPrefs, overlay)) return board;
  return applyLayout(board, densityOrPrefs, overlay);
}

function rootMeta(nodes: TNode[]): Pick<TopicNodeData, "groupId" | "cellIndex" | "familyIndex" | "role"> {
  const groupId = nextGroupId(nodes);
  return {
    groupId,
    cellIndex: CENTER_CELL_INDEX,
    familyIndex: familyIndexForGroup(groupId),
    role: "source",
  };
}

function withSprout(board: Board, parentId: string, childIds: string[]): Board {
  const parentPos = board.nodes.find((node) => node.id === parentId)?.position;
  if (!parentPos) return board;
  return {
    ...board,
    nodes: board.nodes.map((node) => {
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
  };
}

export function createRootBoard(
  board: Board,
  label: string,
  densityOrPrefs: Density | LayoutPrefs = "comfortable",
  overlay = false,
): Board {
  const trimmed = label.trim().slice(0, ROOT_LABEL_MAX);
  const meta = rootMeta([]);
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
      ...meta,
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
  const meta = rootMeta(board.nodes);
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
      ...meta,
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

function beginRadialExpand(
  board: Board,
  parent: TNode,
  count: number,
  densityOrPrefs: Density | LayoutPrefs,
  overlay: boolean,
): { board: Board; childIds: string[]; edgeIds: string[] } {
  const existingChildren = board.nodes.filter((node) => node.data.parentId === parent.id).length;
  const children: TNode[] = Array.from({ length: count }, (_, index) => ({
    id: createId("n"),
    position: { ...parent.position },
    data: {
      label: "…",
      memo: "",
      parentId: parent.id,
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
    source: parent.id,
    target: child.id,
  }));
  const childIds = children.map((child) => child.id);
  const edgeIds = edges.map((edge) => edge.id);
  const next = applyLayout(
    touch(board, {
      nodes: board.nodes
        .map((node) =>
          node.id === parent.id ? { ...node, data: { ...node.data, expanding: true, expanded: true } } : node,
        )
        .concat(children),
      edges: [...board.edges, ...edges],
      focusedNodeId: parent.id,
    }),
    densityOrPrefs,
    overlay,
  );
  return { board: withSprout(next, parent.id, childIds), childIds, edgeIds };
}

function beginFillGroup(
  board: Board,
  parent: TNode,
  densityOrPrefs: Density | LayoutPrefs,
  overlay: boolean,
): { board: Board; childIds: string[]; edgeIds: string[] } {
  const groupId = parent.data.groupId ?? nextGroupId(board.nodes);
  const familyIndex = parent.data.familyIndex ?? familyIndexForGroup(groupId);
  const used = usedCellIndices(board.nodes, groupId);
  const missing = KEYWORD_CELL_INDICES.filter((index) => !used.has(index));
  const children: TNode[] = missing.map((cellIndex, index) => ({
    id: createId("n"),
    position: { ...parent.position },
    data: {
      label: "…",
      memo: "",
      parentId: parent.id,
      expanded: false,
      expanding: false,
      placeholder: true,
      depth: parent.data.depth + 1,
      appearIndex: index,
      sproutX: 0,
      sproutY: 0,
      groupId,
      cellIndex,
      familyIndex,
      role: "keyword",
    },
  }));
  const childIds = children.map((child) => child.id);
  const next = applyLayout(
    touch(board, {
      nodes: board.nodes
        .map((node) =>
          node.id === parent.id
            ? {
                ...node,
                data: {
                  ...node.data,
                  expanding: true,
                  expanded: true,
                  groupId,
                  cellIndex: parent.data.cellIndex ?? CENTER_CELL_INDEX,
                  familyIndex,
                  role: "source" as const,
                },
              }
            : node,
        )
        .concat(children),
      focusedNodeId: parent.id,
    }),
    densityOrPrefs,
    overlay,
  );
  return { board: withSprout(next, parent.id, childIds), childIds, edgeIds: [] };
}

function beginNewMandala(
  board: Board,
  parent: TNode,
  densityOrPrefs: Density | LayoutPrefs,
  overlay: boolean,
): { board: Board; childIds: string[]; edgeIds: string[] } {
  const groupId = nextGroupId(board.nodes);
  const familyIndex = familyIndexForGroup(groupId);
  const keywords: TNode[] = KEYWORD_CELL_INDICES.map((cellIndex, index) => ({
    id: createId("n"),
    position: { ...parent.position },
    data: {
      label: "…",
      memo: "",
      parentId: parent.id,
      expanded: false,
      expanding: false,
      placeholder: true,
      depth: parent.data.depth + 1,
      appearIndex: index,
      sproutX: 0,
      sproutY: 0,
      groupId,
      cellIndex,
      familyIndex,
      role: "keyword",
    },
  }));
  const parentCenterId = parent.data.parentId;
  const edgeIds: string[] = [];
  const edges = [...board.edges];
  if (parentCenterId && !edges.some((edge) => edge.source === parentCenterId && edge.target === parent.id)) {
    const edge: TEdge = { id: createId("e"), source: parentCenterId, target: parent.id };
    edges.push(edge);
    edgeIds.push(edge.id);
  }
  const childIds = keywords.map((node) => node.id);
  const next = applyLayout(
    touch(board, {
      nodes: board.nodes
        .map((node) =>
          node.id === parent.id
            ? {
                ...node,
                data: {
                  ...node.data,
                  expanding: true,
                  expanded: true,
                  role: "source" as const,
                  familyIndex,
                  hostsGroupId: groupId,
                },
              }
            : node,
        )
        .concat(keywords),
      edges,
      focusedNodeId: parent.id,
    }),
    densityOrPrefs,
    overlay,
  );
  return { board: withSprout(next, parent.id, childIds), childIds, edgeIds };
}

function isIncompleteMandalaCenter(board: Board, parent: TNode): boolean {
  const groupId = parent.data.groupId;
  const isCenter =
    parent.data.cellIndex === CENTER_CELL_INDEX ||
    parent.data.role === "source" ||
    parent.data.parentId === null;
  if (!isCenter) return false;
  if (typeof groupId !== "number") return true;
  const members = board.nodes.filter((node) => node.data.groupId === groupId);
  return members.length < 9;
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
  const prefs = normalizePrefs(densityOrPrefs, overlay);
  if (prefs.generationLayout === "mandala") {
    if (isIncompleteMandalaCenter(board, parent)) {
      return beginFillGroup(board, parent, densityOrPrefs, overlay);
    }
    return beginNewMandala(board, parent, densityOrPrefs, overlay);
  }
  return beginRadialExpand(board, parent, count, densityOrPrefs, overlay);
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
  let labelIndex = 0;
  return applyLayout(
    touch(board, {
      nodes: board.nodes.map((node) => {
        if (node.id === parentId) {
          return { ...node, data: { ...node.data, expanding: false, expanded: true, placeholder: false } };
        }
        if (!childIds.includes(node.id)) return node;
        if (!node.data.placeholder) return node;
        const label = labels[labelIndex] ?? `話題 ${labelIndex + 1}`;
        labelIndex += 1;
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
    nodes: remaining.map((node) => {
      if (node.id !== action.parentId) return node;
      const stillHasKids = remaining.some((child) => child.data.parentId === action.parentId);
      const homeFamily =
        typeof node.data.groupId === "number" ? familyIndexForGroup(node.data.groupId) : node.data.familyIndex;
      return {
        ...node,
        data: {
          ...node.data,
          expanded: stillHasKids,
          expanding: false,
          hostsGroupId: stillHasKids ? node.data.hostsGroupId : undefined,
          role: stillHasKids
            ? node.data.role
            : node.data.cellIndex === CENTER_CELL_INDEX || node.data.parentId === null
              ? "source"
              : "keyword",
          familyIndex: stillHasKids ? node.data.familyIndex : homeFamily,
        },
      };
    }),
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
  return maybeLayout(
    touch(board, {
      nodes: board.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, memo: memo.slice(0, MEMO_MAX) } } : node,
      ),
    }),
    densityOrPrefs,
    overlay,
  );
}

export function setLabel(
  board: Board,
  nodeId: string,
  label: string,
  densityOrPrefs: Density | LayoutPrefs = "comfortable",
  overlay = false,
): Board {
  const trimmed = label.trim().slice(0, LABEL_EDIT_MAX);
  if (!trimmed) return board;
  return maybeLayout(
    touch(board, {
      nodes: board.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, label: trimmed } } : node,
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
  return maybeLayout(
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

export function duplicateBoard(board: Board, name?: string): Board {
  const now = Date.now();
  return {
    ...board,
    id: createId("board"),
    name: name?.trim() || `${board.name}のコピー`,
    createdAt: now,
    updatedAt: now,
    nodes: board.nodes.map(cloneNode),
    edges: board.edges.map(cloneEdge),
  };
}

export function toggleHeart(board: Board, nodeId: string): Board {
  return touch(board, {
    nodes: board.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const current = node.data.heartCount ?? 0;
      const next = current > 0 ? 0 : 1;
      return { ...node, data: { ...node.data, heartCount: next || undefined } };
    }),
  });
}

export function bumpHeart(board: Board, nodeId: string, delta = 1): Board {
  if (delta === 0) return board;
  return touch(board, {
    nodes: board.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const next = Math.max(0, Math.min(9999, (node.data.heartCount ?? 0) + delta));
      return { ...node, data: { ...node.data, heartCount: next || undefined } };
    }),
  });
}

export function bumpFrameHearts(board: Board, nodeId: string, delta = 1): Board {
  if (delta === 0) return board;
  return touch(board, {
    nodes: board.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const next = Math.max(0, Math.min(9999, (node.data.frameHearts ?? 0) + delta));
      return { ...node, data: { ...node.data, frameHearts: next || undefined } };
    }),
  });
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
