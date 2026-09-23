import { asColorTheme } from "@/lib/color-theme";
import { DEFAULT_SETTINGS, STORAGE_KEY } from "@/lib/constants";
import { createId, todayBoardName } from "@/lib/ids";
import type { AppSnapshot, Board, Settings, TEdge, TNode } from "@/lib/types";

export function emptyBoard(name = todayBoardName()): Board {
  const now = Date.now();
  return {
    id: createId("board"),
    name,
    createdAt: now,
    updatedAt: now,
    nodes: [],
    edges: [],
    pinnedNodeId: null,
    focusedNodeId: null,
  };
}

export function defaultSnapshot(): AppSnapshot {
  const board = emptyBoard();
  return {
    version: 2,
    boards: [board],
    activeBoardId: board.id,
    settings: { ...DEFAULT_SETTINGS },
  };
}

function asNode(value: unknown): TNode | null {
  if (!value || typeof value !== "object") return null;
  const node = value as TNode;
  if (typeof node.id !== "string" || !node.position || !node.data) return null;
  if (node.data.placeholder) return null;
  return {
    id: node.id,
    position: {
      x: Number(node.position.x) || 0,
      y: Number(node.position.y) || 0,
    },
    data: {
      label: String(node.data.label ?? ""),
      memo: String(node.data.memo ?? ""),
      parentId: node.data.parentId ?? null,
      expanded: Boolean(node.data.expanded),
      expanding: false,
      depth: Number(node.data.depth) || 0,
      appearIndex: Number(node.data.appearIndex) || 0,
      groupId: typeof node.data.groupId === "number" && node.data.groupId > 0 ? node.data.groupId : undefined,
      cellIndex:
        typeof node.data.cellIndex === "number" && node.data.cellIndex >= 0 && node.data.cellIndex <= 8
          ? node.data.cellIndex
          : undefined,
      familyIndex:
        typeof node.data.familyIndex === "number" && node.data.familyIndex >= 0
          ? node.data.familyIndex
          : undefined,
      role: node.data.role === "source" || node.data.role === "keyword" ? node.data.role : undefined,
      copiedFromId: typeof node.data.copiedFromId === "string" ? node.data.copiedFromId : undefined,
    },
  };
}

function asEdge(value: unknown): TEdge | null {
  if (!value || typeof value !== "object") return null;
  const edge = value as TEdge;
  if (!edge.id || !edge.source || !edge.target) return null;
  return { id: String(edge.id), source: String(edge.source), target: String(edge.target) };
}

function asBoard(value: unknown): Board | null {
  if (!value || typeof value !== "object") return null;
  const board = value as Board;
  if (typeof board.id !== "string" || typeof board.name !== "string") return null;
  const nodes = (Array.isArray(board.nodes) ? board.nodes : []).map(asNode).filter((node): node is TNode => Boolean(node));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = (Array.isArray(board.edges) ? board.edges : [])
    .map(asEdge)
    .filter((edge): edge is TEdge => Boolean(edge && nodeIds.has(edge.source) && nodeIds.has(edge.target)));
  return {
    id: board.id,
    name: board.name || todayBoardName(),
    createdAt: Number(board.createdAt) || Date.now(),
    updatedAt: Number(board.updatedAt) || Date.now(),
    nodes,
    edges,
    pinnedNodeId: board.pinnedNodeId && nodeIds.has(board.pinnedNodeId) ? board.pinnedNodeId : null,
    focusedNodeId: board.focusedNodeId && nodeIds.has(board.focusedNodeId) ? board.focusedNodeId : null,
  };
}

function asSettings(value: unknown, snapshotVersion = 2): Settings {
  const settings = (value && typeof value === "object" ? value : {}) as Partial<Settings>;
  const fontScale = Number(settings.fontScale);
  const storedLayout = settings.generationLayout;
  let generationLayout: Settings["generationLayout"] = "mandala";
  if (snapshotVersion >= 2) {
    generationLayout = storedLayout === "radial" ? "radial" : "mandala";
  } else if (storedLayout === "mandala") {
    generationLayout = "mandala";
  }
  return {
    geminiApiKey: typeof settings.geminiApiKey === "string" ? settings.geminiApiKey : "",
    geminiModel: typeof settings.geminiModel === "string" && settings.geminiModel ? settings.geminiModel : DEFAULT_SETTINGS.geminiModel,
    fontScale: Number.isFinite(fontScale) ? Math.min(1.6, Math.max(0.85, fontScale)) : 1,
    density: settings.density === "compact" ? "compact" : "comfortable",
    overlayTransparent: settings.overlayTransparent !== false,
    nickname: typeof settings.nickname === "string" ? settings.nickname.slice(0, 24) : "",
    colorTheme: asColorTheme(settings.colorTheme),
    generationLayout,
  };
}

export { asBoard };

export function parseSnapshot(raw: unknown): AppSnapshot {
  const fallback = defaultSnapshot();
  if (!raw || typeof raw !== "object") return fallback;
  const data = raw as Partial<AppSnapshot>;
  const boards = (Array.isArray(data.boards) ? data.boards : []).map(asBoard).filter((board): board is Board => Boolean(board));
  if (boards.length === 0) return fallback;
  const activeBoardId = boards.some((board) => board.id === data.activeBoardId)
    ? (data.activeBoardId as string)
    : boards[0]!.id;
  const version = data.version === 2 ? 2 : 1;
  return {
    version: 2,
    boards,
    activeBoardId,
    settings: asSettings(data.settings, version),
  };
}

export function loadSnapshot(): AppSnapshot {
  if (typeof window === "undefined") return defaultSnapshot();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSnapshot();
    return parseSnapshot(JSON.parse(raw));
  } catch {
    return defaultSnapshot();
  }
}

export function saveSnapshot(snapshot: AppSnapshot) {
  if (typeof window === "undefined") return;
  const payload: AppSnapshot = {
    ...snapshot,
    version: 2,
    boards: snapshot.boards.map((board) => ({
      ...board,
      nodes: board.nodes.filter((node) => !node.data.placeholder),
    })),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function exportSnapshot(snapshot: AppSnapshot, includeApiKey = false): string {
  const payload = {
    ...snapshot,
    settings: {
      ...snapshot.settings,
      geminiApiKey: includeApiKey ? snapshot.settings.geminiApiKey : "",
    },
  };
  return JSON.stringify(payload, null, 2);
}
