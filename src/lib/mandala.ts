import {
  estimateLocalBox,
  GLYPH_PAD,
  hasGlyphOverlap,
  type Point,
} from "@/lib/node-box";
import type { Board, LayoutPrefs, TNode } from "@/lib/types";

export const MANDALA_OFFSETS: Point[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

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

function neighborsFree(origin: Grid, taken: Set<string>): boolean {
  return MANDALA_OFFSETS.every((offset) => !taken.has(cellKey(origin.gx + offset.x, origin.gy + offset.y)));
}

function pickBlockOrigin(parent: Grid, outward: Point, taken: Set<string>): Grid {
  if (neighborsFree(parent, taken)) return parent;
  const dirs = [
    outward,
    ...CARDINALS.filter((dir) => !(dir.x === outward.x && dir.y === outward.y)),
  ];
  for (const scale of [2, 3, 4, 5, 6]) {
    for (const dir of dirs) {
      const origin = { gx: parent.gx + dir.x * scale, gy: parent.gy + dir.y * scale };
      if (neighborsFree(origin, taken) && !taken.has(cellKey(origin.gx, origin.gy))) return origin;
    }
  }
  let radius = 2;
  while (radius < 24) {
    for (let gx = parent.gx - radius; gx <= parent.gx + radius; gx += 1) {
      for (let gy = parent.gy - radius; gy <= parent.gy + radius; gy += 1) {
        if (Math.max(Math.abs(gx - parent.gx), Math.abs(gy - parent.gy)) !== radius) continue;
        const origin = { gx, gy };
        if (neighborsFree(origin, taken) && !taken.has(cellKey(origin.gx, origin.gy))) return origin;
      }
    }
    radius += 1;
  }
  return { gx: parent.gx + outward.x * 3, gy: parent.gy + outward.y * 3 };
}

export function mandalaPitch(nodes: TNode[], prefs: Required<LayoutPrefs>): { pitchX: number; pitchY: number } {
  let width = 168;
  let height = 72;
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
  const dummy: TNode[] = Array.from({ length: count }, (_, index) => ({
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
    const offset = MANDALA_OFFSETS[index] ?? { x: (index % 3) - 1, y: Math.floor(index / 3) - 1 };
    return {
      x: parent.x + (origin.gx + offset.x) * pitchX,
      y: parent.y + (origin.gy + offset.y) * pitchY,
    };
  });
}

export function layoutMandala(board: Board, prefs: Required<LayoutPrefs>): Board {
  if (board.nodes.length === 0) return board;
  const grids = new Map<string, Grid>();
  const taken = new Set<string>();
  const roots = childrenOf(board.nodes, null);

  function occupy(id: string, grid: Grid) {
    grids.set(id, grid);
    taken.add(cellKey(grid.gx, grid.gy));
  }

  function layoutKids(parent: TNode) {
    const kids = childrenOf(board.nodes, parent.id);
    if (kids.length === 0) return;
    const parentGrid = grids.get(parent.id) ?? { gx: 0, gy: 0 };
    const grandId = parent.data.parentId;
    const grandGrid = grandId ? grids.get(grandId) : null;
    const outward = grandGrid ? unitStep(grandGrid, parentGrid) : { x: 0, y: 0 };
    const origin = pickBlockOrigin(parentGrid, outward, taken);
    if (origin.gx !== parentGrid.gx || origin.gy !== parentGrid.gy) {
      taken.add(cellKey(origin.gx, origin.gy));
    }
    kids.forEach((kid, index) => {
      const offset = MANDALA_OFFSETS[index] ?? { x: (index % 3) - 1, y: Math.floor(index / 3) - 1 };
      occupy(kid.id, { gx: origin.gx + offset.x, gy: origin.gy + offset.y });
    });
    kids.forEach(layoutKids);
  }

  let rootCursor = 0;
  roots.forEach((root, index) => {
    if (index === 0) {
      occupy(root.id, { gx: 0, gy: 0 });
    } else {
      rootCursor += 6;
      occupy(root.id, { gx: rootCursor, gy: 0 });
    }
    layoutKids(root);
    const usedX = [...grids.values()].map((grid) => grid.gx);
    rootCursor = Math.max(rootCursor, ...usedX) + 4;
  });

  let { pitchX, pitchY } = mandalaPitch(board.nodes, prefs);
  const toPositions = () => {
    const positions = new Map<string, Point>();
    for (const node of board.nodes) {
      const grid = grids.get(node.id) ?? { gx: 0, gy: 0 };
      positions.set(node.id, { x: grid.gx * pitchX, y: grid.gy * pitchY });
    }
    return positions;
  };

  let positions = toPositions();
  for (let grow = 0; grow < 8 && hasGlyphOverlap(board.nodes, positions, prefs, GLYPH_PAD - 1); grow += 1) {
    pitchX += 12;
    pitchY += 10;
    positions = toPositions();
  }

  return {
    ...board,
    nodes: board.nodes.map((node) => {
      const next = positions.get(node.id);
      if (!next) return node;
      if (next.x === node.position.x && next.y === node.position.y) return node;
      return { ...node, position: next };
    }),
  };
}
