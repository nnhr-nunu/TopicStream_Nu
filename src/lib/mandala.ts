import {
  estimateLocalBox,
  GLYPH_PAD,
  hasGlyphOverlap,
  type Point,
} from "@/lib/node-box";
import {
  CENTER_CELL_INDEX,
  familyIndexForGroup,
  KEYWORD_CELL_INDICES,
  MANDALA_CELL_OFFSETS,
} from "@/lib/mandala-ids";
import type { Board, LayoutPrefs, TNode } from "@/lib/types";

export { MANDALA_CELL_OFFSETS };
export const MANDALA_OFFSETS: Point[] = KEYWORD_CELL_INDICES.map(
  (index) => MANDALA_CELL_OFFSETS[index]!,
);

const CARDINALS: Point[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

type Grid = { gx: number; gy: number };

function cellKey(gx: number, gy: number): string {
  return `${gx}:${gy}`;
}

function childrenOf(nodes: TNode[], parentId: string | null): TNode[] {
  return nodes
    .filter((node) => node.data.parentId === parentId)
    .sort((a, b) => a.data.appearIndex - b.data.appearIndex || a.id.localeCompare(b.id));
}

function unitStep(from: Grid, to: Grid): Point {
  const dx = Math.sign(to.gx - from.gx);
  const dy = Math.sign(to.gy - from.gy);
  if (dx === 0 && dy === 0) return { x: 1, y: 0 };
  return { x: dx, y: dy };
}

function neighborsFree(origin: Grid, taken: Set<string>, includeCenter = true): boolean {
  const offsets = includeCenter ? MANDALA_CELL_OFFSETS : MANDALA_OFFSETS;
  return offsets.every((offset) => !taken.has(cellKey(origin.gx + offset.x, origin.gy + offset.y)));
}

function pickBlockOrigin(parent: Grid, outward: Point, taken: Set<string>, includeCenter = true): Grid {
  if (includeCenter) {
    if (neighborsFree(parent, taken, true) && !taken.has(cellKey(parent.gx, parent.gy))) return parent;
  } else if (neighborsFree(parent, taken, false)) {
    return parent;
  }
  const dirs = [
    outward,
    ...CARDINALS.filter((dir) => !(dir.x === outward.x && dir.y === outward.y)),
  ];
  for (const scale of [2, 3, 4, 5, 6, 7, 8]) {
    for (const dir of dirs) {
      const origin = { gx: parent.gx + dir.x * scale, gy: parent.gy + dir.y * scale };
      const centerTaken = taken.has(cellKey(origin.gx, origin.gy));
      if (neighborsFree(origin, taken, includeCenter) && (!includeCenter || !centerTaken)) return origin;
    }
  }
  let radius = 2;
  while (radius < 24) {
    for (let gx = parent.gx - radius; gx <= parent.gx + radius; gx += 1) {
      for (let gy = parent.gy - radius; gy <= parent.gy + radius; gy += 1) {
        if (Math.max(Math.abs(gx - parent.gx), Math.abs(gy - parent.gy)) !== radius) continue;
        const origin = { gx, gy };
        const centerTaken = taken.has(cellKey(origin.gx, origin.gy));
        if (neighborsFree(origin, taken, includeCenter) && (!includeCenter || !centerTaken)) return origin;
      }
    }
    radius += 1;
  }
  return { gx: parent.gx + outward.x * 3, gy: parent.gy + outward.y * 3 };
}

export function mandalaPitch(nodes: TNode[], prefs: Required<LayoutPrefs>): { pitchX: number; pitchY: number } {
  let width = 184;
  let height = 88;
  for (const node of nodes) {
    const box = estimateLocalBox(node, prefs);
    width = Math.max(width, box.right - box.left);
    height = Math.max(height, box.bottom - box.top);
  }
  return {
    pitchX: Math.ceil(width + GLYPH_PAD * 2),
    pitchY: Math.ceil(height + GLYPH_PAD * 2),
  };
}

export function placeMandalaChildren(options: {
  parent: Point;
  count: number;
  existing: Point[];
  awayFrom?: Point | null;
  prefs: Required<LayoutPrefs>;
}): Point[] {
  const { parent, count, awayFrom, prefs } = options;
  const dummy: TNode[] = Array.from({ length: Math.max(count, 1) }, (_, index) => ({
    id: `m-${index}`,
    position: parent,
    data: {
      label: "キーワードの例です",
      memo: "",
      parentId: "p",
      expanded: false,
      expanding: false,
      depth: 1,
      appearIndex: index,
      groupId: 1,
      cellIndex: index === 0 && count === 9 ? CENTER_CELL_INDEX : KEYWORD_CELL_INDICES[index] ?? index,
      familyIndex: 0,
      role: index === 0 && count === 9 ? "source" : "keyword",
    },
  }));
  const { pitchX, pitchY } = mandalaPitch(dummy, prefs);
  const outward = awayFrom
    ? { x: Math.sign(parent.x - awayFrom.x) || 1, y: Math.sign(parent.y - awayFrom.y) }
    : { x: 0, y: 0 };
  const origin =
    outward.x === 0 && outward.y === 0
      ? { gx: 0, gy: 0 }
      : { gx: outward.x * 2, gy: outward.y * 2 };
  return Array.from({ length: count }, (_, index) => {
    const offset =
      count === 9
        ? (MANDALA_CELL_OFFSETS[index] ?? { x: (index % 3) - 1, y: Math.floor(index / 3) - 1 })
        : (MANDALA_OFFSETS[index] ?? { x: (index % 3) - 1, y: Math.floor(index / 3) - 1 });
    return {
      x: parent.x + (origin.gx + offset.x) * pitchX,
      y: parent.y + (origin.gy + offset.y) * pitchY,
    };
  });
}

function patchNode(node: TNode, patch: Partial<TNode["data"]>): TNode {
  return { ...node, data: { ...node.data, ...patch } };
}

export function ensureMandalaMeta(nodes: TNode[]): TNode[] {
  if (nodes.length === 0) return nodes;
  if (nodes.every((node) => typeof node.data.groupId === "number" && typeof node.data.cellIndex === "number")) {
    return nodes.map((node) => {
      const groupId = node.data.groupId ?? 1;
      const cellIndex = node.data.cellIndex ?? CENTER_CELL_INDEX;
      return patchNode(node, {
        groupId,
        cellIndex,
        familyIndex: node.data.familyIndex ?? familyIndexForGroup(groupId),
        role: node.data.role ?? (cellIndex === CENTER_CELL_INDEX ? "source" : "keyword"),
      });
    });
  }

  const assigned = new Map<string, { groupId: number; cellIndex: number }>();
  const usedGroups = new Set<number>();

  for (const node of nodes) {
    if (typeof node.data.groupId === "number" && typeof node.data.cellIndex === "number") {
      assigned.set(node.id, { groupId: node.data.groupId, cellIndex: node.data.cellIndex });
      usedGroups.add(node.data.groupId);
    }
  }

  const allocGroup = () => {
    let id = 1;
    while (usedGroups.has(id)) id += 1;
    usedGroups.add(id);
    return id;
  };

  const roots = childrenOf(nodes, null);
  const queue: TNode[] = [];

  for (const root of roots) {
    if (!assigned.has(root.id)) {
      assigned.set(root.id, { groupId: allocGroup(), cellIndex: CENTER_CELL_INDEX });
    }
    queue.push(root);
  }

  while (queue.length > 0) {
    const parent = queue.shift()!;
    const kids = childrenOf(nodes, parent.id);
    const parentMeta = assigned.get(parent.id);
    if (!parentMeta) continue;

    const siblingCells = new Set(
      kids
        .map((kid) => assigned.get(kid.id)?.cellIndex)
        .filter((index): index is number => typeof index === "number"),
    );
    const groupMembers = [...assigned.values()].filter((meta) => meta.groupId === parentMeta.groupId);
    const groupCells = new Set(groupMembers.map((meta) => meta.cellIndex));
    const parentIsCenter = parentMeta.cellIndex === CENTER_CELL_INDEX;

    for (const kid of kids) {
      if (!assigned.has(kid.id)) {
        if (parentIsCenter) {
          const nextCell = KEYWORD_CELL_INDICES.find((index) => !groupCells.has(index) && !siblingCells.has(index));
          if (nextCell !== undefined) {
            assigned.set(kid.id, { groupId: parentMeta.groupId, cellIndex: nextCell });
            groupCells.add(nextCell);
            siblingCells.add(nextCell);
          } else {
            assigned.set(kid.id, { groupId: allocGroup(), cellIndex: CENTER_CELL_INDEX });
          }
        } else {
          assigned.set(kid.id, { groupId: allocGroup(), cellIndex: CENTER_CELL_INDEX });
        }
      }
      queue.push(kid);
    }
  }

  for (const node of nodes) {
    if (assigned.has(node.id)) continue;
    assigned.set(node.id, { groupId: allocGroup(), cellIndex: CENTER_CELL_INDEX });
  }

  return nodes.map((node) => {
    const meta = assigned.get(node.id)!;
    return patchNode(node, {
      groupId: meta.groupId,
      cellIndex: meta.cellIndex,
      familyIndex: node.data.familyIndex ?? familyIndexForGroup(meta.groupId),
      role: node.data.role ?? (meta.cellIndex === CENTER_CELL_INDEX ? "source" : "keyword"),
    });
  });
}

function groupCenter(nodes: TNode[], groupId: number): TNode | undefined {
  return (
    nodes.find((node) => node.data.hostsGroupId === groupId) ??
    nodes.find((node) => node.data.groupId === groupId && node.data.cellIndex === CENTER_CELL_INDEX) ??
    nodes.find((node) => node.data.groupId === groupId && node.data.role === "source")
  );
}

function groupMembers(nodes: TNode[], groupId: number): TNode[] {
  const hub = nodes.find((node) => node.data.hostsGroupId === groupId);
  return nodes
    .filter((node) => {
      if (hub && node.id === hub.id) return true;
      if (node.data.hostsGroupId) return false;
      return node.data.groupId === groupId;
    })
    .sort((a, b) => (a.data.cellIndex ?? 99) - (b.data.cellIndex ?? 99) || a.id.localeCompare(b.id));
}

export function layoutMandala(board: Board, prefs: Required<LayoutPrefs>): Board {
  if (board.nodes.length === 0) return board;
  const nodes = ensureMandalaMeta(board.nodes);
  const grids = new Map<string, Grid>();
  const taken = new Set<string>();

  function occupy(id: string, grid: Grid) {
    grids.set(id, grid);
    taken.add(cellKey(grid.gx, grid.gy));
  }

  const groupIds = [
    ...new Set(
      nodes.flatMap((node) => [node.data.groupId, node.data.hostsGroupId]).filter((id): id is number => typeof id === "number"),
    ),
  ].sort((a, b) => a - b);

  const placedGroups = new Set<number>();

  function placeGroup(groupId: number, origin: Grid) {
    const hub = nodes.find((node) => node.data.hostsGroupId === groupId);
    const members = groupMembers(nodes, groupId);
    if (hub) {
      occupy(hub.id, origin);
      for (const member of members) {
        if (member.id === hub.id) continue;
        const index = member.data.cellIndex ?? 0;
        const offset = MANDALA_CELL_OFFSETS[index] ?? { x: 0, y: 0 };
        occupy(member.id, { gx: origin.gx + offset.x, gy: origin.gy + offset.y });
      }
      placedGroups.add(groupId);
      return;
    }
    const byCell = new Map(members.map((node) => [node.data.cellIndex ?? -1, node]));
    for (let index = 0; index < 9; index += 1) {
      const offset = MANDALA_CELL_OFFSETS[index] ?? { x: 0, y: 0 };
      const grid = { gx: origin.gx + offset.x, gy: origin.gy + offset.y };
      const member = byCell.get(index);
      if (member) occupy(member.id, grid);
      else taken.add(cellKey(grid.gx, grid.gy));
    }
    placedGroups.add(groupId);
  }

  function attachOrigin(groupId: number): Grid {
    const center = groupCenter(nodes, groupId);
    const anchorId = center?.data.copiedFromId ?? center?.data.parentId ?? null;
    const anchorGrid = anchorId ? grids.get(anchorId) : undefined;
    if (!anchorGrid) {
      const usedX = [...grids.values()].map((grid) => grid.gx);
      const cursor = usedX.length ? Math.max(...usedX) + 4 : 0;
      return { gx: cursor, gy: 0 };
    }
    const grandId = nodes.find((node) => node.id === anchorId)?.data.parentId ?? null;
    const grandGrid = grandId ? grids.get(grandId) : null;
    const outward = grandGrid ? unitStep(grandGrid, anchorGrid) : { x: 1, y: 0 };
    return pickBlockOrigin(anchorGrid, outward, taken, true);
  }

  for (const groupId of groupIds) {
    if (placedGroups.has(groupId)) continue;
    const center = groupCenter(nodes, groupId);
    const anchorId = center?.data.copiedFromId ?? center?.data.parentId ?? null;
    if (anchorId && !grids.has(anchorId)) continue;
    const origin = grids.size === 0 ? { gx: 0, gy: 0 } : attachOrigin(groupId);
    placeGroup(groupId, origin);
  }

  let guard = 0;
  while (placedGroups.size < groupIds.length && guard < groupIds.length + 2) {
    guard += 1;
    for (const groupId of groupIds) {
      if (placedGroups.has(groupId)) continue;
      placeGroup(groupId, attachOrigin(groupId));
    }
  }

  for (const node of nodes) {
    if (!grids.has(node.id)) occupy(node.id, { gx: 0, gy: 0 });
  }

  let { pitchX, pitchY } = mandalaPitch(nodes, prefs);
  const toPositions = () => {
    const positions = new Map<string, Point>();
    for (const node of nodes) {
      const grid = grids.get(node.id) ?? { gx: 0, gy: 0 };
      positions.set(node.id, { x: grid.gx * pitchX, y: grid.gy * pitchY });
    }
    return positions;
  };

  let positions = toPositions();
  for (let grow = 0; grow < 8 && hasGlyphOverlap(nodes, positions, prefs, GLYPH_PAD - 1); grow += 1) {
    pitchX += 12;
    pitchY += 10;
    positions = toPositions();
  }

  return {
    ...board,
    nodes: nodes.map((node) => {
      const next = positions.get(node.id);
      if (!next) return node;
      if (next.x === node.position.x && next.y === node.position.y) return node;
      return { ...node, position: next };
    }),
  };
}
