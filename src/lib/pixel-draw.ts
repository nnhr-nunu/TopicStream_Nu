/**
 * ドット絵を図形で描く小さな道具（リアルな動物の絵に使う）。
 * 楕円・多角形・太さのある線で形を塗り、shadeRows で上を明るく・下を暗くして外側に輪郭を付ける
 */
import type { Sprite } from "@/lib/critter-sprite";

export type PixelCanvas = {
  w: number;
  h: number;
  /** 楕円（中心と半径。ピクセルの中心で判定）。only を渡すと、その文字の上にだけ塗る */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string, only?: string): PixelCanvas;
  /** 多角形（頂点の並び） */
  poly(points: [number, number][], c: string, only?: string): PixelCanvas;
  /** 太さのある線（端は丸い） */
  line(x0: number, y0: number, x1: number, y1: number, c: string, width?: number, only?: string): PixelCanvas;
  dot(x: number, y: number, c: string): PixelCanvas;
  rows(): string[];
};

export function pixelCanvas(w: number, h: number): PixelCanvas {
  const grid = Array.from({ length: h }, () => Array.from({ length: w }, () => "."));
  const paint = (test: (px: number, py: number) => boolean, c: string, only?: string) => {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (test(x + 0.5, y + 0.5) && (!only || only.includes(grid[y]![x]!))) grid[y]![x] = c;
      }
    }
  };
  const api: PixelCanvas = {
    w,
    h,
    ellipse(cx, cy, rx, ry, c, only) {
      paint((px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1, c, only);
      return api;
    },
    poly(points, c, only) {
      paint(
        (px, py) => {
          let inside = false;
          for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
            const [xi, yi] = points[i]!;
            const [xj, yj] = points[j]!;
            if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
          }
          return inside;
        },
        c,
        only,
      );
      return api;
    },
    line(x0, y0, x1, y1, c, width = 1, only) {
      const r2 = (width / 2) ** 2;
      const vx = x1 - x0;
      const vy = y1 - y0;
      const len2 = vx * vx + vy * vy || 1;
      paint(
        (px, py) => {
          const t = Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / len2));
          return (px - (x0 + t * vx)) ** 2 + (py - (y0 + t * vy)) ** 2 <= r2;
        },
        c,
        only,
      );
      return api;
    },
    dot(x, y, c) {
      const [px, py] = [Math.round(x), Math.round(y)];
      if (px >= 0 && py >= 0 && px < w && py < h) grid[py]![px] = c;
      return api;
    },
    rows: () => grid.map((row) => row.join("")),
  };
  return api;
}

export type ShadeSpec = {
  /** 領域の文字 → [暗い, ふつう, 明るい] の3文字。ここに無い文字（目・模様など）はそのまま */
  shade: Record<string, string>;
  /** 外側の輪郭の文字 */
  outline: string;
  /** 領域ごとの輪郭の文字（足先だけ色を変える など） */
  outlineFor?: Record<string, string>;
  /** 輪郭を付けない細い線（触角） */
  bare?: string;
};

/**
 * 陰影と輪郭を付ける: 領域の上の縁（外か別の領域と接する）を明るく、下の縁を暗く。
 * 模様のような塗りっぱなしの文字は境目にしない。透明なところのうち形に接するドットを輪郭にする
 */
export function shadeRows(rows: string[], spec: ShadeSpec): string[] {
  const h = rows.length;
  const w = rows[0]!.length;
  const bare = spec.bare ?? "";
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? "." : rows[y]![x]!);
  const solid = (x: number, y: number) => at(x, y) !== "." && !bare.includes(at(x, y));
  const edge = (x: number, y: number, region: string) =>
    !solid(x, y) || (spec.shade[at(x, y)] !== undefined && at(x, y) !== region);
  const grid = rows.map((row) => [...row]);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const region = rows[y]![x]!;
      const shades = spec.shade[region];
      if (!shades) continue;
      grid[y]![x] = edge(x, y - 1, region) ? shades[2]! : edge(x, y + 1, region) ? shades[0]! : shades[1]!;
    }
  }
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (rows[y]![x] !== ".") continue;
      const next = (
        [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ] as const
      ).find(([nx, ny]) => solid(nx, ny));
      if (next) grid[y]![x] = spec.outlineFor?.[at(next[0], next[1])] ?? spec.outline;
    }
  }
  return grid.map((row) => row.join(""));
}

/** 図形で描いた各コマに陰影と輪郭を付けて、絵にする */
export function shadedSprite(
  px: number,
  palette: Record<string, string>,
  spec: ShadeSpec,
  frames: Record<string, string[]>,
): Sprite {
  return {
    px,
    palette,
    frames: Object.fromEntries(Object.entries(frames).map(([name, rows]) => [name, shadeRows(rows, spec)])),
  };
}
