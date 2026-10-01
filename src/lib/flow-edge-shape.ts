/** 流れの線（親カード → 子カード）の形の計算。描くのは flow-edge.tsx */

export type Point = { x: number; y: number };
/** カードの箱（左上の位置と大きさ） */
export type Box = { x: number; y: number; w: number; h: number };

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

/**
 * 曲線が箱の縁を越える t を二分探索で求め、縁のすぐ外側の t を返す。inT の位置は箱の中、outT の位置は箱の外
 * （どちらが大きくてもよい）。outT の位置も箱の中なら outT のまま返る
 */
function edgeOfBox(p0: Point, c: Point, p2: Point, box: Box, pad: number, inT: number, outT: number): number {
  for (let i = 0; i < 18; i++) {
    const mid = (inT + outT) / 2;
    if (inside(at(p0, c, p2, mid), box, pad)) inT = mid;
    else outT = mid;
  }
  return outT;
}

/** 矢じりの長さ（線の太さに合わせる） */
function arrowLength(strokeWidth: number): number {
  return Math.max(9, strokeWidth * 3.6);
}

export type FlowEdgeShape = {
  /** 線の SVG パス（線の始まり → 線の終わり。2次ベジェ） */
  path: string;
  /** 矢じりの SVG パス */
  head: string;
  /** 線の始まり（元のカードの縁 +2px） */
  start: Point;
  /** 線の終わり（矢じりの付け根の少し先） */
  end: Point;
  /** 矢じりの先（行き先のカードの縁 +5px） */
  tip: Point;
  /** 矢じりの向き（先での曲線の接線。長さ 1） */
  direction: Point;
};

/**
 * 親カードの箱から子カードの箱へ、少しだけ弧を描く線と、子の手前の矢じりの形を求める。
 * soft: 放射（もともと近いので、ほんの少しだけ曲げる）。箱どうしが重なっている（広げている途中）ときなどは null（線を出さない）
 */
export function flowEdgeShape(
  fromBox: Box,
  toBox: Box,
  { soft, strokeWidth }: { soft: boolean; strokeWidth: number },
): FlowEdgeShape | null {
  const from = centerOf(fromBox);
  const to = centerOf(toBox);

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  // マンダラートは間のカード（高さの半分 ≒ 42px）の上を跨いで見えるよう、頂点を最大 64px 膨らませる。
  // 放射はもともと近いので、ほんの少しだけ曲げる。2次ベジェの頂点は制御点の半分の位置なので、制御点は頂点の2倍ずらす。
  const peak = soft ? Math.min(18, length * 0.08) : Math.min(64, length * 0.15);
  const control = {
    x: (from.x + to.x) / 2 + (dy / length) * peak * 2,
    y: (from.y + to.y) / 2 - (dx / length) * peak * 2,
  };

  // 箱どうしが重なっている（広げている途中）ときは線を出さない
  if (inside(to, fromBox, 0) || inside(from, toBox, 0)) return null;

  const arrow = arrowLength(strokeWidth);
  // 線は元のカードの縁 +2px から出し、矢じりの先は子のカードの縁 +5px に置く。探す範囲は曲線の真ん中（t = 0.5）で切らない。
  // 横長のカードが隣にあると真ん中もまだカードの中で、そこに置くと矢じりがカードの下に隠れる
  const t0 = edgeOfBox(from, control, to, fromBox, 2, 0, 1);
  const tipT = edgeOfBox(from, control, to, toBox, 5, 1, t0);
  // 線の始まりがもう子の箱（+5px）の中なら tipT = t0 のまま（近すぎて矢じりを置く間が無い）
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
  const toward = Math.hypot(tangent.x, tangent.y) > 0.001 ? tangent : { x: dx, y: dy };
  const size = Math.hypot(toward.x, toward.y) || 1;
  const ux = toward.x / size;
  const uy = toward.y / size;
  const half = arrow * 0.5;
  const baseX = tip.x - ux * arrow;
  const baseY = tip.y - uy * arrow;
  const head = `M ${tip.x},${tip.y} L ${baseX - uy * half},${baseY + ux * half} Q ${tip.x - ux * arrow * 0.72},${tip.y - uy * arrow * 0.72} ${baseX + uy * half},${baseY - ux * half} Z`;

  return { path, head, start, end, tip, direction: { x: ux, y: uy } };
}
