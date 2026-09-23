import { RADIUS } from "@/lib/constants";
import type { Density } from "@/lib/types";
import type { Point } from "@/lib/node-box";

export type { Point };

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

export function hasOverlap(points: Point[], gap: number): boolean {
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (distance(points[i]!, points[j]!) < gap - 0.5) return true;
    }
  }
  return false;
}

export function bboxCenter(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}
