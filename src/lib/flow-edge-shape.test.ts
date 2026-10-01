import { describe, expect, it } from "vitest";

import { flowEdgeShape, type Box, type Point } from "@/lib/flow-edge-shape";

/** 中心と大きさからカードの箱を作る */
function card(cx: number, cy: number, w: number, h: number): Box {
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** 点が箱の縁からどれだけ外にあるか（上下左右の離れ方の大きい方。箱の中ならマイナス） */
function gap(point: Point, box: Box): number {
  return Math.max(box.x - point.x, point.x - (box.x + box.w), box.y - point.y, point.y - (box.y + box.h));
}

describe("flowEdgeShape", () => {
  it("線は元のカードの縁 +2px から出て、矢じりの先は行き先のカードの縁 +5px に来て、行き先を向く", () => {
    const cases = [
      {
        name: "マンダラート（2 マス先へ大きく弧を描く）",
        parent: card(0, 0, 184, 84),
        child: card(400, 0, 184, 84),
        soft: false,
        strokeWidth: 3,
      },
      { name: "放射（すぐ下）", parent: card(0, 0, 120, 37), child: card(30, 160, 140, 37), soft: true, strokeWidth: 2 },
      { name: "放射（左上）", parent: card(0, 0, 150, 37), child: card(-220, -90, 160, 37), soft: true, strokeWidth: 2 },
    ];
    for (const { name, parent, child, soft, strokeWidth } of cases) {
      const shape = flowEdgeShape(parent, child, { soft, strokeWidth });
      expect(shape, name).not.toBeNull();
      expect(gap(shape!.start, parent), name).toBeCloseTo(2, 2);
      expect(gap(shape!.tip, child), name).toBeCloseTo(5, 2);
      expect(gap(shape!.end, child), name).toBeGreaterThan(5);
      const toward = { x: child.x + child.w / 2 - (parent.x + parent.w / 2), y: child.y + child.h / 2 - (parent.y + parent.h / 2) };
      expect(shape!.direction.x * toward.x + shape!.direction.y * toward.y, name).toBeGreaterThan(0);
    }
  });

  it("横長のカードが親のすぐ横にあっても、矢じりの先は子のカードの下に隠れず、子の縁 +5px（親の側）に来る", () => {
    // 中心どうしは約 210px。曲線の真ん中（t = 0.5）が子のカードの中に入る並び（放射で長い語が親の隣に来たとき）
    const parent = card(0, 0, 120, 37);
    const child = card(210, -12, 229, 37);
    const shape = flowEdgeShape(parent, child, { soft: true, strokeWidth: 2 });
    expect(shape).not.toBeNull();
    expect(gap(shape!.tip, child)).toBeCloseTo(5, 2);
    expect(shape!.tip.x).toBeLessThan(child.x);
    expect(gap(shape!.end, child)).toBeGreaterThan(5);
    expect(gap(shape!.start, parent)).toBeCloseTo(2, 2);
  });

  it("横長の親のすぐ横に子があっても、線は親のカードの下からではなく、親の縁 +2px から出る", () => {
    const parent = card(0, 0, 229, 37);
    const child = card(210, 12, 120, 37);
    const shape = flowEdgeShape(parent, child, { soft: true, strokeWidth: 2 });
    expect(shape).not.toBeNull();
    expect(gap(shape!.start, parent)).toBeCloseTo(2, 2);
    expect(shape!.start.x).toBeGreaterThan(parent.x + parent.w);
    expect(gap(shape!.tip, child)).toBeCloseTo(5, 2);
  });

  it("カードどうしが重なっているときや、近すぎて矢じりを置く間が無いときは線を出さない", () => {
    expect(flowEdgeShape(card(0, 0, 120, 37), card(40, 10, 120, 37), { soft: true, strokeWidth: 2 })).toBeNull();
    // 縁どうしが 4px（線の出だしの 2px と矢じりの手前の 5px が重なる）
    expect(flowEdgeShape(card(0, 0, 120, 37), card(124, 0, 120, 37), { soft: true, strokeWidth: 2 })).toBeNull();
  });
});
