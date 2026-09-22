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
  if (overlay) return 176;
  return density === "compact" ? 136 : 152;
}

export function ringRadius(depth: number, density: Density, overlay = false): number {
  if (depth <= 0) return 0;
  return radiusFor(density, overlay) * depth;
}

/** 親から子までの最短半径。円周上の弦が gap 以上になるまで広げる。 */
export function compactFanRadius(count: number, gap: number, span: number): number {
  if (count <= 1) return Math.max(gap * 0.94, 108);
  const half = span >= Math.PI * 1.95 ? Math.PI / count : span / (2 * Math.max(count - 1, 1));
  const fromChord = gap / (2 * Math.sin(Math.max(half, 0.16)));
  const minR = gap * 0.94;
  const maxR = gap * 1.55;
  return Math.min(Math.max(fromChord, minR), maxR);
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

export function hasOverlap(points: Point[], gap: number): boolean {
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (distance(points[i]!, points[j]!) < gap - 0.5) return true;
    }
  }
  return false;
}

function pointsOnFan(parent: Point, count: number, radius: number, center: number, span: number): Point[] {
  return evenAngles(count, center, span).map((angle) => ({
    x: parent.x + Math.cos(angle) * radius,
    y: parent.y + Math.sin(angle) * radius,
  }));
}

function collisionScore(points: Point[], existing: Point[], gap: number): number {
  let score = 0;
  for (let i = 0; i < points.length; i += 1) {
    const others = [...existing, ...points.slice(0, i)];
    for (const other of others) {
      const extra = gap - distance(points[i]!, other);
      if (extra > 0) score += extra;
    }
  }
  return score;
}

function clusterAroundParent(parent: Point, count: number, outward: number, gap: number, grow: number, fullCircle: boolean): Point[] {
  if (count <= 0) return [];
  const floor = gap * 0.94;
  if (fullCircle || count <= 4) {
    const span = fullCircle ? Math.PI * 2 : Math.min(Math.PI * 1.05, 0.42 * count + 0.7);
    const radius = Math.max(compactFanRadius(count, gap, span), floor) + grow;
    return pointsOnFan(parent, count, radius, outward, span);
  }
  const innerCount = Math.min(3, count);
  const outerCount = count - innerCount;
  const innerSpan = Math.min(Math.PI * 0.7, 0.36 * innerCount + 0.5);
  const outerSpan = Math.min(Math.PI * 1.02, 0.3 * outerCount + 0.78);
  const innerR = Math.max(compactFanRadius(innerCount, gap, innerSpan), floor) + grow * 0.2;
  const outerR = innerR + gap + grow;
  return [
    ...pointsOnFan(parent, innerCount, innerR, outward, innerSpan),
    ...pointsOnFan(parent, outerCount, outerR, outward + (outerSpan / Math.max(outerCount, 1)) * 0.5, outerSpan),
  ];
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
  const { parent, count, existing, awayFrom, density, overlay = false, parentDepth } = options;
  if (count <= 0) return [];

  const gap = minNodeGap(density, overlay);
  const isRootFan = (parentDepth ?? 0) === 0 || !awayFrom;
  const outward = awayFrom
    ? Math.atan2(parent.y - awayFrom.y, parent.x - awayFrom.x)
    : -Math.PI / 2;
  const rotations = isRootFan
    ? [0, Math.PI / Math.max(count, 1) / 2]
    : Array.from({ length: 9 }, (_, i) => (i - 4) * 0.13);

  const others = existing.filter((point) => distance(point, parent) > 8);
  const capGrow = 18;

  let best: Point[] = [];
  let bestScore = Number.POSITIVE_INFINITY;
  let bestGrow = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const grow = Math.min(attempt * 5, capGrow);
    for (const rotation of rotations) {
      const points = clusterAroundParent(parent, count, outward + rotation, gap, grow, isRootFan);
      const score = collisionScore(points, others, gap);
      if (score < bestScore - 0.01 || (Math.abs(score - bestScore) <= 0.01 && grow < bestGrow)) {
        best = points;
        bestScore = score;
        bestGrow = grow;
      }
      if (score === 0) return points;
    }
  }
  return best;
}

function childrenOf(nodes: TNode[], parentId: string | null): TNode[] {
  return nodes
    .filter((node) => node.data.parentId === parentId)
    .sort((a, b) => a.data.appearIndex - b.data.appearIndex || a.id.localeCompare(b.id));
}

/**
 * 子は親のすぐ近く。同じ親の子は等間隔。世代が外側のリング。
 * 重なれば深い側だけ、親から見て外へ少し押す（遠くへ飛ばさない）。
 */
export function layoutBoard(board: Board, density: Density, overlay = false): Board {
  if (board.nodes.length === 0) return board;
  const gap = minNodeGap(density, overlay);
  const positions = new Map<string, Point>();
  const parentOf = new Map<string, string | null>();
  for (const node of board.nodes) parentOf.set(node.id, node.data.parentId);
  const roots = childrenOf(board.nodes, null);
  const rootGap = radiusFor(density, overlay) * 2.05;

  roots.forEach((root, index) => {
    positions.set(root.id, roots.length === 1 ? { x: 0, y: 0 } : { x: (index - (roots.length - 1) / 2) * rootGap, y: 0 });
  });

  function layoutKids(parent: TNode) {
    const kids = childrenOf(board.nodes, parent.id);
    if (kids.length === 0) return;
    const parentPos = positions.get(parent.id) ?? parent.position;
    const grandId = parent.data.parentId;
    const grandPos = grandId ? positions.get(grandId) : null;
    const points = placeChildren({
      parent: parentPos,
      count: kids.length,
      existing: [...positions.values()],
      awayFrom: grandPos ?? null,
      density,
      overlay,
      parentDepth: parent.data.depth,
    });
    kids.forEach((kid, index) => {
      positions.set(kid.id, points[index] ?? parentPos);
    });
    kids.forEach(layoutKids);
  }

  for (const root of roots) layoutKids(root);

  const maxFromParent = gap * 2.12;
  const ids = board.nodes.map((node) => node.id);
  const depthOf = (id: string) => board.nodes.find((node) => node.id === id)?.data.depth ?? 0;

  for (let pass = 0; pass < 6; pass += 1) {
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
        const deeper = depthOf(aId) >= depthOf(bId) ? aId : bId;
        if (parentOf.get(aId) && parentOf.get(aId) === parentOf.get(bId)) continue;
        const pos = positions.get(deeper)!;
        const parentId = parentOf.get(deeper);
        const origin = (parentId ? positions.get(parentId) : null) ?? { x: 0, y: 0 };
        const ox = pos.x - origin.x;
        const oy = pos.y - origin.y;
        const len = Math.hypot(ox, oy) || 1;
        const bumped = Math.min(len + Math.min((gap - d) * 0.5 + 4, 12), maxFromParent);
        positions.set(deeper, {
          x: origin.x + (ox / len) * bumped,
          y: origin.y + (oy / len) * bumped,
        });
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
