import { RADIUS } from "@/lib/constants";
import type { Density } from "@/lib/types";

type Point = { x: number; y: number };

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function radiusFor(density: Density, overlay = false): number {
  if (overlay) return RADIUS.overlay;
  return density === "compact" ? RADIUS.compact : RADIUS.comfortable;
}

export function placeChildren(options: {
  parent: Point;
  count: number;
  existing: Point[];
  awayFrom?: Point | null;
  density: Density;
  overlay?: boolean;
  ring?: number;
}): Point[] {
  const { parent, count, existing, awayFrom, density, overlay = false, ring = 1 } = options;
  const base = radiusFor(density, overlay) * (0.82 + ring * 0.22);
  let startAngle = -Math.PI / 2;
  if (awayFrom) {
    startAngle = Math.atan2(parent.y - awayFrom.y, parent.x - awayFrom.x);
  }

  const minGap = base * 0.72;
  let radius = base;
  const points: Point[] = [];

  for (let attempt = 0; attempt < 6; attempt += 1) {
    points.length = 0;
    let collided = false;
    for (let i = 0; i < count; i += 1) {
      const angle = startAngle + (i * 2 * Math.PI) / count + attempt * 0.17;
      const point = {
        x: parent.x + Math.cos(angle) * radius,
        y: parent.y + Math.sin(angle) * radius,
      };
      const hit = [...existing, ...points].some((other) => distance(other, point) < minGap);
      if (hit) collided = true;
      points.push(point);
    }
    if (!collided) break;
    radius += base * 0.18;
  }

  return points;
}

export function bboxCenter(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}
