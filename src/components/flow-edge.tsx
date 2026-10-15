"use client";

import { BaseEdge, useInternalNode, type EdgeProps } from "@xyflow/react";

import { flowEdgeShape, type Box } from "@/lib/flow-edge-shape";

function boxOf(node: ReturnType<typeof useInternalNode>): Box | null {
  if (!node) return null;
  const { x, y } = node.internals.positionAbsolute;
  return { x, y, w: node.measured.width ?? 0, h: node.measured.height ?? 0 };
}

/**
 * 広げた流れの線。親カードから子カードへ、少しだけ弧を描いて結び、子の手前に矢じりを付ける（どちらへ広がったか追えるように）。
 * 線はカードの縁で止めるので、途中のカードの下をくぐってもよい（React Flow の辺レイヤーはカードの後ろ）。形の計算は flow-edge-shape.ts
 */
export function FlowEdge({ id, source, target, style, data }: EdgeProps) {
  const fromBox = boxOf(useInternalNode(source));
  const toBox = boxOf(useInternalNode(target));
  if (!fromBox || !toBox) return null;
  const soft = (data as { soft?: boolean } | undefined)?.soft === true;
  const shape = flowEdgeShape(fromBox, toBox, { soft, strokeWidth: Number(style?.strokeWidth ?? 2) });
  if (!shape) return null;

  return (
    <>
      <BaseEdge id={id} path={shape.path} style={style} className="flow-edge" />
      <path
        d={shape.head}
        className="flow-edge-arrow"
        style={{
          fill: style?.stroke as string | undefined,
          fillOpacity: style?.strokeOpacity as number | undefined,
        }}
      />
    </>
  );
}
