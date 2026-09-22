import {
  compactGap,
  defaultLocalBox,
  estimateLocalBox,
  GLYPH_PAD,
  hasGlyphOverlap,
  overlapScore,
  penetration,
  type LocalBox,
  type Point,
} from "@/lib/node-box";
import { distance } from "@/lib/radial";
import type { Board, LayoutPrefs, TNode } from "@/lib/types";

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

function pointsOnFan(parent: Point, count: number, radius: number, center: number, span: number): Point[] {
  return evenAngles(count, center, span).map((angle) => ({
    x: parent.x + Math.cos(angle) * radius,
    y: parent.y + Math.sin(angle) * radius,
  }));
}

function fanRadius(count: number, gap: number, span: number): number {
  if (count <= 1) return Math.max(gap * 0.92, 96);
  const half = span >= Math.PI * 1.95 ? Math.PI / count : span / (2 * Math.max(count - 1, 1));
  const fromChord = gap / (2 * Math.sin(Math.max(half, 0.12)));
  return Math.max(fromChord, gap * 0.9);
}

function clusterAroundParent(parent: Point, count: number, outward: number, gap: number, grow: number, fullCircle: boolean): Point[] {
  if (count <= 0) return [];
  if (fullCircle || count <= 4) {
    const span = fullCircle ? Math.PI * 2 : Math.min(Math.PI * 1.08, 0.44 * count + 0.68);
    const radius = fanRadius(count, gap, span) + grow;
    return pointsOnFan(parent, count, radius, outward, span);
  }
  const innerCount = Math.min(3, count);
  const outerCount = count - innerCount;
  const innerSpan = Math.min(Math.PI * 0.72, 0.36 * innerCount + 0.5);
  const outerSpan = Math.min(Math.PI * 1.05, 0.3 * outerCount + 0.78);
  const innerR = fanRadius(innerCount, gap, innerSpan) + grow * 0.18;
  const outerR = innerR + gap + grow;
  return [
    ...pointsOnFan(parent, innerCount, innerR, outward, innerSpan),
    ...pointsOnFan(parent, outerCount, outerR, outward + (outerSpan / Math.max(outerCount, 1)) * 0.45, outerSpan),
  ];
}

function siblingGap(childBoxes: LocalBox[], parentBox: LocalBox): number {
  const among = childBoxes.length
    ? Math.max(...childBoxes.map((box, index) => compactGap(box, childBoxes[(index + 1) % childBoxes.length]!, GLYPH_PAD)))
    : 120;
  const toParent = childBoxes.length ? Math.max(...childBoxes.map((box) => compactGap(box, parentBox, GLYPH_PAD))) : among;
  return Math.max(among * 0.92, toParent * 0.72, 96);
}

export function placeRadialChildren(options: {
  parent: Point;
  count: number;
  existing: Point[];
  awayFrom?: Point | null;
  parentDepth?: number;
  prefs: Required<LayoutPrefs>;
  parentNode?: TNode;
  childNodes?: TNode[];
  existingNodes?: TNode[];
}): Point[] {
  const { parent, count, existing, awayFrom, prefs, parentDepth, parentNode, childNodes, existingNodes } = options;
  if (count <= 0) return [];

  const parentBox = parentNode ? estimateLocalBox(parentNode, prefs) : defaultLocalBox(prefs);
  const childBoxes =
    childNodes && childNodes.length === count
      ? childNodes.map((node) => estimateLocalBox(node, prefs))
      : Array.from({ length: count }, () => defaultLocalBox(prefs));
  const gap = siblingGap(childBoxes, parentBox);
  const isRootFan = (parentDepth ?? parentNode?.data.depth ?? 0) === 0 || !awayFrom;
  const outward = awayFrom
    ? Math.atan2(parent.y - awayFrom.y, parent.x - awayFrom.x)
    : -Math.PI / 2;
  const rotations = isRootFan
    ? [0, Math.PI / Math.max(count, 1) / 2]
    : Array.from({ length: 7 }, (_, i) => (i - 3) * 0.11);

  const others = existing.filter((point) => distance(point, parent) > 8);
  let best: Point[] = [];
  let bestScore = Number.POSITIVE_INFINITY;
  let bestGrow = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const grow = attempt * 8;
    for (const rotation of rotations) {
      const points = clusterAroundParent(parent, count, outward + rotation, gap, grow, isRootFan);
      const fakeKids: TNode[] = points.map((point, index) => ({
        id: `tmp-${index}`,
        position: point,
        data: childNodes?.[index]?.data ?? {
          label: "キーワードの例です",
          memo: "",
          parentId: "p",
          expanded: false,
          expanding: false,
          depth: 1,
          appearIndex: index,
        },
      }));
      const fakeParent: TNode = parentNode ?? {
        id: "parent-tmp",
        position: parent,
        data: {
          label: "親",
          memo: "",
          parentId: null,
          expanded: true,
          expanding: false,
          depth: 0,
          appearIndex: 0,
        },
      };
      const nodes = [fakeParent, ...fakeKids];
      const positions = new Map<string, Point>([
        [fakeParent.id, parent],
        ...fakeKids.map((kid, index) => [kid.id, points[index]!] as const),
      ]);
      const extras: TNode[] =
        existingNodes?.filter((node) => node.id !== fakeParent.id) ??
        others.map((point, index) => ({
          id: `ex-${index}`,
          position: point,
          data: {
            label: "既存",
            memo: "",
            parentId: "other",
            expanded: false,
            expanding: false,
            depth: 1,
            appearIndex: index,
          },
        }));
      extras.forEach((node) => {
        nodes.push(node);
        positions.set(node.id, node.position);
      });
      const score = overlapScore(nodes, positions, prefs, GLYPH_PAD);
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

function separateGlyphs(board: Board, positions: Map<string, Point>, prefs: Required<LayoutPrefs>) {
  const parentOf = new Map(board.nodes.map((node) => [node.id, node.data.parentId] as const));
  const depthOf = new Map(board.nodes.map((node) => [node.id, node.data.depth] as const));
  const ids = board.nodes.map((node) => node.id);

  for (let pass = 0; pass < 18; pass += 1) {
    let moved = false;
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const aId = ids[i]!;
        const bId = ids[j]!;
        const aNode = board.nodes.find((node) => node.id === aId)!;
        const bNode = board.nodes.find((node) => node.id === bId)!;
        const aPos = positions.get(aId);
        const bPos = positions.get(bId);
        if (!aPos || !bPos) continue;
        const aBox = { ...estimateLocalBox(aNode, prefs) };
        const bBox = { ...estimateLocalBox(bNode, prefs) };
        const aAbs = {
          left: aPos.x + aBox.left,
          right: aPos.x + aBox.right,
          top: aPos.y + aBox.top,
          bottom: aPos.y + aBox.bottom,
        };
        const bAbs = {
          left: bPos.x + bBox.left,
          right: bPos.x + bBox.right,
          top: bPos.y + bBox.top,
          bottom: bPos.y + bBox.bottom,
        };
        const push = penetration(aAbs, bAbs, GLYPH_PAD);
        if (!push) continue;
        const deeper = (depthOf.get(aId) ?? 0) >= (depthOf.get(bId) ?? 0) ? aId : bId;
        const shallower = deeper === aId ? bId : aId;
        const sameParent = parentOf.get(aId) && parentOf.get(aId) === parentOf.get(bId);
        const moveId = sameParent ? deeper : deeper;
        const originId = parentOf.get(moveId);
        const origin = (originId ? positions.get(originId) : null) ?? { x: 0, y: 0 };
        const pos = positions.get(moveId)!;
        const delta = moveId === aId ? push : { x: -push.x, y: -push.y };
        const next = { x: pos.x + delta.x * 0.62, y: pos.y + delta.y * 0.62 };
        const fromParent = { x: next.x - origin.x, y: next.y - origin.y };
        const len = Math.hypot(fromParent.x, fromParent.y) || 1;
        const other = positions.get(shallower)!;
        const away = { x: next.x - other.x, y: next.y - other.y };
        const awayLen = Math.hypot(away.x, away.y) || 1;
        positions.set(moveId, {
          x: origin.x + (fromParent.x / len) * len + (away.x / awayLen) * 2,
          y: origin.y + (fromParent.y / len) * len + (away.y / awayLen) * 2,
        });
        moved = true;
      }
    }
    if (!moved) break;
  }
}

export function layoutRadial(board: Board, prefs: Required<LayoutPrefs>): Board {
  if (board.nodes.length === 0) return board;
  const positions = new Map<string, Point>();
  const roots = childrenOf(board.nodes, null);

  roots.forEach((root, index) => {
    if (roots.length === 1) {
      positions.set(root.id, { x: 0, y: 0 });
      return;
    }
    const box = estimateLocalBox(root, prefs);
    const pitch = box.right - box.left + GLYPH_PAD * 2 + 48;
    positions.set(root.id, { x: (index - (roots.length - 1) / 2) * pitch, y: 0 });
  });

  function layoutKids(parent: TNode) {
    const kids = childrenOf(board.nodes, parent.id);
    if (kids.length === 0) return;
    const parentPos = positions.get(parent.id) ?? parent.position;
    const grandId = parent.data.parentId;
    const grandPos = grandId ? positions.get(grandId) : null;
    const placed = board.nodes
      .filter((node) => positions.has(node.id))
      .map((node) => ({ ...node, position: positions.get(node.id)! }));
    const points = placeRadialChildren({
      parent: parentPos,
      count: kids.length,
      existing: [...positions.values()],
      awayFrom: grandPos ?? null,
      parentDepth: parent.data.depth,
      prefs,
      parentNode: { ...parent, position: parentPos },
      childNodes: kids,
      existingNodes: placed,
    });
    kids.forEach((kid, index) => {
      positions.set(kid.id, points[index] ?? parentPos);
    });
    kids.forEach(layoutKids);
  }

  for (const root of roots) layoutKids(root);

  separateGlyphs(board, positions, prefs);
  if (hasGlyphOverlap(board.nodes, positions, prefs, GLYPH_PAD - 1)) {
    separateGlyphs(board, positions, prefs);
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
