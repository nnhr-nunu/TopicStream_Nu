"use client";

import { BaseEdge, useInternalNode, type EdgeProps } from "@xyflow/react";

type Point = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };

function boxOf(node: ReturnType<typeof useInternalNode>): Box | null {
  if (!node) return null;
  const { x, y } = node.internals.positionAbsolute;
  return { x, y, w: node.measured.width ?? 0, h: node.measured.height ?? 0 };
}

function centerOf(box: Box): Point {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

function inside(point: Point, box: Box, pad: number): boolean {
  return (
    point.x >= box.x - pad && point.x <= box.x + box.w + pad && point.y >= box.y - pad && point.y <= box.y + box.h + pad
  );
}

/** 2次ベジェの t の位置 */
function at(p0: Point, c: Point, p2: Point, t: number): Point {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p2.y };
}

/** 2次ベジェの [t0, t1] の部分の制御点（ブロッサム） */
function subControl(p0: Point, c: Point, p2: Point, t0: number, t1: number): Point {
  const a = (1 - t0) * (1 - t1);
  const b = (1 - t0) * t1 + t0 * (1 - t1);
  const d = t0 * t1;
  return { x: a * p0.x + b * c.x + d * p2.x, y: a * p0.y + b * c.y + d * p2.y };
}

/** 曲線が箱の外へ出る（入る）境目の t を二分探索で求める。lo 側が箱の中、hi 側が外 */
function edgeOfBox(p0: Point, c: Point, p2: Point, box: Box, pad: number, lo: number, hi: number): number {
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (inside(at(p0, c, p2, mid), box, pad)) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** 矢じりの長さ（線の太さに合わせる） */
function arrowLength(strokeWidth: number): number {
  return Math.max(9, strokeWidth * 3.6);
}

/**
 * 広げた流れの線。親カードから子カードへ、少しだけ弧を描いて結び、子の手前に矢じりを付ける（どちらへ広がったか追えるように）。
 * 線はカードの縁で止めるので、途中のカードの下をくぐってもよい（React Flow の辺レイヤーはカードの後ろ）。
 */
export function FlowEdge({ id, source, target, style, data }: EdgeProps) {
  const fromBox = boxOf(useInternalNode(source));
  const toBox = boxOf(useInternalNode(target));
  if (!fromBox || !toBox) return null;
  const from = centerOf(fromBox);
  const to = centerOf(toBox);

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  // マンダラートは間のカード（高さの半分 ≒ 42px）の上を跨いで見えるよう、頂点を最大 64px 膨らませる。
  // 放射はもともと近いので、ほんの少しだけ曲げる。2次ベジェの頂点は制御点の半分の位置なので、制御点は頂点の2倍ずらす。
  const soft = (data as { soft?: boolean } | undefined)?.soft === true;
  const peak = soft ? Math.min(18, length * 0.08) : Math.min(64, length * 0.15);
  const control = {
    x: (from.x + to.x) / 2 + (dy / length) * peak * 2,
    y: (from.y + to.y) / 2 - (dx / length) * peak * 2,
  };

  // 箱どうしが重なっている（広げている途中）ときは線を出さない
  if (inside(to, fromBox, 0) || inside(from, toBox, 0)) return null;

  const strokeWidth = Number(style?.strokeWidth ?? 2);
  const arrow = arrowLength(strokeWidth);
  const t0 = edgeOfBox(from, control, to, fromBox, 2, 0, 0.5);
  const tipT = 1 - edgeOfBox(to, control, from, toBox, 5, 0, 0.5);
  if (tipT <= t0) return null;
  const tip = at(from, control, to, tipT);
  // 線は矢じりの付け根の少し先で止める（丸い線端が矢じりの先からはみ出さないように）
  let lineEnd = tipT;
  for (let lo = t0, hi = tipT, i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const point = at(from, control, to, mid);
    if (Math.hypot(tip.x - point.x, tip.y - point.y) > arrow * 0.6) lo = mid;
    else hi = mid;
    lineEnd = lo;
  }
  const start = at(from, control, to, t0);
  const end = at(from, control, to, lineEnd);
  const mid = subControl(from, control, to, t0, lineEnd);
  const path = `M ${start.x},${start.y} Q ${mid.x},${mid.y} ${end.x},${end.y}`;

  // 矢じりの向きは、先端での曲線の接線（2次ベジェの微分 ∝ (1-t)(C-P0) + t(P2-C)）
  const tangent = {
    x: (1 - tipT) * (control.x - from.x) + tipT * (to.x - control.x),
    y: (1 - tipT) * (control.y - from.y) + tipT * (to.y - control.y),
  };
  const direction = Math.hypot(tangent.x, tangent.y) > 0.001 ? tangent : { x: dx, y: dy };
  const size = Math.hypot(direction.x, direction.y) || 1;
  const ux = direction.x / size;
  const uy = direction.y / size;
  const half = arrow * 0.5;
  const baseX = tip.x - ux * arrow;
  const baseY = tip.y - uy * arrow;
  const head = `M ${tip.x},${tip.y} L ${baseX - uy * half},${baseY + ux * half} Q ${tip.x - ux * arrow * 0.72},${tip.y - uy * arrow * 0.72} ${baseX + uy * half},${baseY - ux * half} Z`;

  return (
    <>
      <BaseEdge id={id} path={path} style={style} className="flow-edge" />
      <path
        d={head}
        className="flow-edge-arrow"
        style={{
          fill: style?.stroke as string | undefined,
          fillOpacity: style?.strokeOpacity as number | undefined,
        }}
      />
    </>
  );
}
