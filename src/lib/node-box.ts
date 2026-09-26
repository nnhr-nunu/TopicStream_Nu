import { LABEL_MAX } from "@/lib/constants";
import type { Density, LayoutPrefs, TNode, TopicNodeData } from "@/lib/types";

export type Point = { x: number; y: number };

export type LocalBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type AbsBox = LocalBox;

export const GLYPH_PAD = 16;

const REM = 16;
const CHIP_MAX = 16 * REM;
const LABEL_LINES = 2;
export const MANDALA_CHIP_W = 11.5 * REM;
export const MANDALA_CHIP_H = 5.25 * REM;

export function normalizePrefs(input?: Density | LayoutPrefs, overlay = false): Required<LayoutPrefs> {
  if (!input || typeof input === "string") {
    return {
      density: input === "compact" ? "compact" : "comfortable",
      overlay,
      fontScale: 1,
      generationLayout: "mandala",
      pinnedNodeId: null,
    };
  }
  return {
    density: input.density ?? "comfortable",
    overlay: input.overlay ?? overlay,
    fontScale: input.fontScale ?? 1,
    generationLayout: input.generationLayout ?? "mandala",
    pinnedNodeId: input.pinnedNodeId ?? null,
  };
}

function isWideChar(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x11ff) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  );
}

export function measureTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    width += isWideChar(code) ? fontSize : fontSize * 0.58;
  }
  return width;
}

function wrapWidths(text: string, maxWidth: number, fontSize: number, maxLines: number): number[] {
  if (!text) return [0];
  const widths: number[] = [];
  let current = 0;
  for (const char of text) {
    const extra = measureTextWidth(char, fontSize);
    if (current > 0 && current + extra > maxWidth && widths.length < maxLines - 1) {
      widths.push(current);
      current = extra;
    } else {
      current += extra;
    }
  }
  widths.push(current);
  return widths.slice(0, maxLines);
}

function densityFactor(density: Density, overlay: boolean): number {
  if (overlay) return density === "compact" ? 0.9 : 1.08;
  return density === "compact" ? 0.82 : 1;
}

export function estimateLocalBox(node: Pick<TNode, "id" | "data">, prefs: Required<LayoutPrefs>): LocalBox {
  const overlay = prefs.overlay;
  const scale = overlay ? Math.max(prefs.fontScale, 1.15) : prefs.fontScale;
  const dense = densityFactor(prefs.density, overlay);
  const isRoot = node.data.parentId === null;
  const isPinned = prefs.pinnedNodeId === node.id;
  // 文のカードは小さめの文字で4行まで（topic-node の fitLabelFontSize と合わせる）
  const detail = isSentenceCard(node.data);
  const fontSize = overlay ? 22 * scale : (isRoot ? 17 : detail ? 12 : 15) * scale;
  const padY = overlay ? 0.7 * REM : 0.55 * REM * dense;
  const padX = overlay ? 1.1 * REM : (isRoot ? 1.15 * REM : 0.95 * REM * dense);
  const nowWidth = isPinned ? fontSize * 0.62 * 3.05 + 0.24 * fontSize + 0.45 * REM : 0;
  const gap = nowWidth > 0 ? 0.45 * REM : 0;
  // カードの幅も文字サイズに合わせて伸び縮みさせる（CSS の calc(… * var(--ts-scale)) と同じ）
  const chipMax = CHIP_MAX * scale;
  const innerMax = Math.max(48, chipMax - padX * 2 - nowWidth - gap);
  const label = node.data.placeholder ? "………" : node.data.label || "話題";
  const lineWidths = wrapWidths(label, innerMax, fontSize, detail ? 4 : LABEL_LINES);
  const labelWidth = Math.min(innerMax, Math.max(...lineWidths, node.data.placeholder ? 4.6 * REM : 0));
  let chipW = Math.min(
    chipMax,
    Math.max(
      node.data.placeholder ? 7.5 * REM : 0,
      padX * 2 + labelWidth + gap + nowWidth + 2,
    ),
  );
  const lineHeight = fontSize * 1.25;
  let chipH = padY * 2 + Math.max(1, lineWidths.length) * lineHeight + 2;
  if (prefs.generationLayout === "mandala") {
    chipW = MANDALA_CHIP_W * scale;
    chipH = MANDALA_CHIP_H * scale;
    return {
      left: -chipW / 2,
      right: chipW / 2,
      top: -chipH / 2,
      bottom: chipH / 2,
    };
  }

  const left = -chipW / 2;
  const right0 = chipW / 2;
  const top = -chipH / 2;
  let right = right0;
  let bottom = chipH / 2;

  const memo = node.data.memo?.trim() ?? "";
  if (memo) {
    const memoFont = 12 * scale;
    const memoW = Math.max(9.5 * REM, 8.4 * REM * scale);
    const memoInner = memoW - 0.55 * REM * 2;
    const memoLines = wrapWidths(memo, memoInner, memoFont, 8);
    const memoH = 0.45 * REM * 2 + memoLines.length * memoFont * 1.45;
    right = Math.max(right, chipW / 2 + 8 + memoW);
    bottom = Math.max(bottom, -chipH / 2 + memoH);
  }

  return { left, right, top, bottom };
}

export function defaultLocalBox(prefs: Required<LayoutPrefs>): LocalBox {
  return estimateLocalBox(
    {
      id: "sample",
      data: {
        label: "キーワードの例です",
        memo: "",
        parentId: "p",
        expanded: false,
        expanding: false,
        depth: 1,
        appearIndex: 0,
      },
    },
    prefs,
  );
}

export function boxAt(origin: Point, local: LocalBox): AbsBox {
  return {
    left: origin.x + local.left,
    right: origin.x + local.right,
    top: origin.y + local.top,
    bottom: origin.y + local.bottom,
  };
}

export function boxesOverlap(a: AbsBox, b: AbsBox, pad = GLYPH_PAD): boolean {
  return !(a.right + pad <= b.left || b.right + pad <= a.left || a.bottom + pad <= b.top || b.bottom + pad <= a.top);
}

export function boxSize(box: LocalBox): { width: number; height: number } {
  return { width: box.right - box.left, height: box.bottom - box.top };
}

export function conservativeGap(a: LocalBox, b: LocalBox, pad = GLYPH_PAD): number {
  const ra = Math.hypot(Math.max(-a.left, a.right), Math.max(-a.top, a.bottom));
  const rb = Math.hypot(Math.max(-b.left, b.right), Math.max(-b.top, b.bottom));
  return ra + rb + pad;
}

export function compactGap(a: LocalBox, b: LocalBox, pad = GLYPH_PAD): number {
  const wa = a.right - a.left;
  const ha = a.bottom - a.top;
  const wb = b.right - b.left;
  const hb = b.bottom - b.top;
  return Math.max((wa + wb) / 2, (ha + hb) / 2, 72) + pad;
}

export function glyphBoxesOf(nodes: TNode[], positions: Map<string, Point>, prefs: Required<LayoutPrefs>): Map<string, AbsBox> {
  const boxes = new Map<string, AbsBox>();
  for (const node of nodes) {
    const pos = positions.get(node.id) ?? node.position;
    boxes.set(node.id, boxAt(pos, estimateLocalBox(node, prefs)));
  }
  return boxes;
}

export function hasGlyphOverlap(nodes: TNode[], positions: Map<string, Point>, prefs: Required<LayoutPrefs>, pad = GLYPH_PAD): boolean {
  const boxes = glyphBoxesOf(nodes, positions, prefs);
  const ids = nodes.map((node) => node.id);
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = boxes.get(ids[i]!);
      const b = boxes.get(ids[j]!);
      if (a && b && boxesOverlap(a, b, pad)) return true;
    }
  }
  return false;
}

export function overlapScore(nodes: TNode[], positions: Map<string, Point>, prefs: Required<LayoutPrefs>, pad = GLYPH_PAD): number {
  const boxes = glyphBoxesOf(nodes, positions, prefs);
  const ids = nodes.map((node) => node.id);
  let score = 0;
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = boxes.get(ids[i]!);
      const b = boxes.get(ids[j]!);
      if (!a || !b || !boxesOverlap(a, b, pad)) continue;
      const overlapX = Math.min(a.right + pad - b.left, b.right + pad - a.left);
      const overlapY = Math.min(a.bottom + pad - b.top, b.bottom + pad - a.top);
      score += Math.max(0, Math.min(overlapX, overlapY));
    }
  }
  return score;
}

export function penetration(a: AbsBox, b: AbsBox, pad = GLYPH_PAD): { x: number; y: number } | null {
  if (!boxesOverlap(a, b, pad)) return null;
  const overlapX = Math.min(a.right + pad - b.left, b.right + pad - a.left);
  const overlapY = Math.min(a.bottom + pad - b.top, b.bottom + pad - a.top);
  const ax = (a.left + a.right) / 2;
  const ay = (a.top + a.bottom) / 2;
  const bx = (b.left + b.right) / 2;
  const by = (b.top + b.bottom) / 2;
  if (overlapX < overlapY) {
    const dir = ax <= bx ? -1 : 1;
    return { x: dir * overlapX, y: 0 };
  }
  const dir = ay <= by ? -1 : 1;
  return { x: 0, y: dir * overlapY };
}

/** 文のカード（「具体的にする」の答えや、図鑑から取り込んだ長い文）。小さめの文字で左寄せにする。中央のお題は除く */
export function isSentenceCard(data: Pick<TopicNodeData, "detail" | "label" | "parentId">): boolean {
  return data.parentId !== null && (Boolean(data.detail) || data.label.length > LABEL_MAX);
}
