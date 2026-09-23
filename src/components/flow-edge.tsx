"use client";

import { BaseEdge, useInternalNode, type EdgeProps } from "@xyflow/react";

function centerOf(node: ReturnType<typeof useInternalNode>) {
  if (!node) return null;
  const { x, y } = node.internals.positionAbsolute;
  const width = node.measured.width ?? 0;
  const height = node.measured.height ?? 0;
  return { x: x + width / 2, y: y + height / 2 };
}

/**
 * マンダラートの「考えの流れ」の線。カードの中心どうしを、少しだけ弧を描く線で結ぶ。
 * 線はカードの後ろ（React Flow の辺レイヤー）に描かれるので、途中のカードの下をくぐってもよい。
 */
export function FlowEdge({ id, source, target, markerEnd, style }: EdgeProps) {
  const from = centerOf(useInternalNode(source));
  const to = centerOf(useInternalNode(target));
  if (!from || !to) return null;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  // 間のカード（高さの半分 ≒ 42px）の上を跨いで見えるよう、頂点を最大 64px 膨らませる。
  // 2次ベジェの頂点は制御点の半分の位置なので、制御点は頂点の2倍ずらす。
  const peak = Math.min(64, length * 0.15);
  const control = {
    x: (from.x + to.x) / 2 + (dy / length) * peak * 2,
    y: (from.y + to.y) / 2 - (dx / length) * peak * 2,
  };
  const path = `M ${from.x},${from.y} Q ${control.x},${control.y} ${to.x},${to.y}`;

  return <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} className="flow-edge" />;
}
