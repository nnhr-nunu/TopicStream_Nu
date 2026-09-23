import { layoutMandala, placeMandalaChildren } from "@/lib/mandala";
import { bboxCenter, hasOverlap, minNodeGap, radiusFor } from "@/lib/radial";
import { layoutRadial, placeRadialChildren } from "@/lib/radial-layout";
import type { Board, Density, LayoutPrefs, TNode } from "@/lib/types";
import { normalizePrefs, type Point } from "@/lib/node-box";

export type { LayoutPrefs } from "@/lib/types";
export { bboxCenter, hasOverlap, minNodeGap, radiusFor };
export { GLYPH_PAD, hasGlyphOverlap, normalizePrefs } from "@/lib/node-box";

export function layoutBoard(board: Board, densityOrPrefs?: Density | LayoutPrefs, overlay = false): Board {
  const prefs = normalizePrefs(densityOrPrefs, overlay);
  const resolved = { ...prefs, pinnedNodeId: prefs.pinnedNodeId ?? board.pinnedNodeId };
  if (board.nodes.length === 0) return board;
  if (resolved.generationLayout === "mandala") return layoutMandala(board, resolved);
  return layoutRadial(board, resolved);
}

export function placeChildren(options: {
  parent: Point;
  count: number;
  existing: Point[];
  awayFrom?: Point | null;
  density: Density;
  overlay?: boolean;
  parentDepth?: number;
  generationLayout?: LayoutPrefs["generationLayout"];
  fontScale?: number;
  pinnedNodeId?: string | null;
  parentNode?: TNode;
  childNodes?: TNode[];
  nodes?: TNode[];
}): Point[] {
  const prefs = normalizePrefs(
    {
      density: options.density,
      overlay: options.overlay,
      fontScale: options.fontScale,
      generationLayout: options.generationLayout,
      pinnedNodeId: options.pinnedNodeId,
    },
    options.overlay ?? false,
  );
  if (prefs.generationLayout === "mandala") {
    return placeMandalaChildren({ ...options, prefs });
  }
  return placeRadialChildren({ ...options, prefs });
}

export function prefsFromSettings(
  settings: { density: Density; fontScale: number; generationLayout: LayoutPrefs["generationLayout"] },
  overlay = false,
  pinnedNodeId: string | null = null,
): Required<LayoutPrefs> {
  return normalizePrefs(
    {
      density: settings.density,
      fontScale: overlay ? Math.max(settings.fontScale, 1.15) : settings.fontScale,
      generationLayout: settings.generationLayout,
      overlay,
      pinnedNodeId,
    },
    overlay,
  );
}
