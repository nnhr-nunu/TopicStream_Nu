import { RADIUS } from "@/lib/constants";
import type { Board, Density, TNode } from "@/lib/types";

export type Point = { x: number; y: number };

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function radiusFor(density: Density, overlay = false): number {
  if (overlay) return RADIUS.overlay;
  return density === "compact" ? RADIUS.compact : RADIUS.comfortable;
}

export function minNodeGap(density: Density, overlay = false): number {
  return Math.round(radiusFor(density, overlay) * 0.92);
}

export function ringRadius(depth: number, density: Density, overlay = false): number {
  if (depth <= 0) return 0;
  return radiusFor(density, overlay) * depth;
}

function evenAngles(count: number, center: number, span: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [center];
  if (span >= Math.PI * 1.95) {
    const start = -Math.PI / 2;
    return Array.from({ length: count }, (_, i) => start + (i * 2 * Math.PI) / count);
  }
  const start = center - span / 2;
  const step = span / (count - 1);
  return Array.from({ length: count }, (_, i) => start + i * step);
}

function collides(point: Point, others: Point[], gap: number): boolean {
  return others.some((other) => distance(point, other) < gap);
}

export function hasOverlap(points: Point[], gap: number): boolean {
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (distance(points[i]!, points[j]!) < gap - 0.5) return true;
    }
  }
  return false;
}

export function placeChildren(options: {
  parent: Point;
  count: number;
  existing: Point[];
  awayFrom?: Point | null;
  density: Density;
  overlay?: boolean;
  ring?: number;
  parentDepth?: number;
}): Point[] {
  const { parent, count, existing, awayFrom, density, overlay = false, ring = 1, parentDepth } = options;
  if (count <= 0) return [];

  const gap = minNodeGap(density, overlay);
  const origin = { x: 0, y: 0 };
  const isRootFan = (parentDepth ?? 0) === 0 || (parent.x === 0 && parent.y === 0 && !awayFrom);
  const outward = awayFrom
    ? Math.atan2(parent.y - awayFrom.y, parent.x - awayFrom.x)
    : isRootFan
      ? -Math.PI / 2
      : Math.atan2(parent.y - origin.y, parent.x - origin.x);
  const span = isRootFan ? Math.PI * 2 : Math.min(Math.PI * 1.28, 0.38 * count + 0.7);
  const localBase = radiusFor(density, overlay) * Math.max(ring, 1);

  let points: Point[] = [];
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const angles = evenAngles(count, outward, span);
    const radius = localBase + attempt * gap * 0.2;
    points = angles.map((angle) => ({
      x: parent.x + Math.cos(angle) * radius,
      y: parent.y + Math.sin(angle) * radius,
    }));
    const hit = points.some((point, index) => collides(point, [...existing, ...points.slice(0, index)], gap));
    if (!hit) return points;
  }
  return points;
}

function childrenOf(nodes: TNode[], parentId: string | null): TNode[] {
  return nodes
    .filter((node) => node.data.parentId === parentId)
    .sort((a, b) => a.data.appearIndex - b.data.appearIndex || a.id.localeCompare(b.id));
}

/**
 * 世代 = 同心円のリング。同じ親の子は等間隔。枝は外向きなので辺が交差しない。
 * 重なれば深い側を外側へ押し出す。
 */
export function layoutBoard(board: Board, density: Density, overlay = false): Board {
  if (board.nodes.length === 0) return board;
  const gap = minNodeGap(density, overlay);
  const positions = new Map<string, Point>();
  const roots = childrenOf(board.nodes, null);
  const rootGap = radiusFor(density, overlay) * 2.7;

  roots.forEach((root, index) => {
    positions.set(root.id, roots.length === 1 ? { x: 0, y: 0 } : { x: (index - (roots.length - 1) / 2) * rootGap, y: 0 });
  });

  function placeFan(parentId: string, origin: Point, depth: number, sectorStart: number, sectorSpan: number) {
    const kids = childrenOf(board.nodes, parentId);
    if (kids.length === 0) return;
    const radius = ringRadius(depth, density, overlay);
    const angles = evenAngles(kids.length, sectorStart + sectorSpan / 2, sectorSpan);
    kids.forEach((kid, index) => {
      const angle = angles[index] ?? -Math.PI / 2;
      let r = radius;
      let pos = { x: origin.x + Math.cos(angle) * r, y: origin.y + Math.sin(angle) * r };
      const others = [...positions.values()];
      for (let guard = 0; guard < 14 && collides(pos, others, gap); guard += 1) {
        r += gap * 0.18;
        pos = { x: origin.x + Math.cos(angle) * r, y: origin.y + Math.sin(angle) * r };
      }
      positions.set(kid.id, pos);
    });
    const slice = sectorSpan / kids.length;
    kids.forEach((kid, index) => {
      placeFan(kid.id, origin, depth + 1, sectorStart + index * slice, slice);
    });
  }

  for (const root of roots) {
    placeFan(root.id, positions.get(root.id) ?? { x: 0, y: 0 }, 1, -Math.PI, Math.PI * 2);
  }

  const ids = board.nodes.map((node) => node.id);
  for (let pass = 0; pass < 10; pass += 1) {
    let moved = false;
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const aId = ids[i]!;
        const bId = ids[j]!;
        const a = positions.get(aId);
        const b = positions.get(bId);
        if (!a || !b) continue;
        const d = distance(a, b);
        if (d >= gap || d < 0.0001) continue;
        const nodeA = board.nodes.find((node) => node.id === aId);
        const nodeB = board.nodes.find((node) => node.id === bId);
        const push = (gap - d) / 2 + 6;
        const ux = (b.x - a.x) / d;
        const uy = (b.y - a.y) / d;
        const aWeight = (nodeA?.data.depth ?? 0) >= (nodeB?.data.depth ?? 0) ? 0.75 : 0.25;
        positions.set(aId, { x: a.x - ux * push * aWeight, y: a.y - uy * push * aWeight });
        positions.set(bId, { x: b.x + ux * push * (1 - aWeight), y: b.y + uy * push * (1 - aWeight) });
        moved = true;
      }
    }
    if (!moved) break;
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

export function bboxCenter(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}
