import { describe, expect, it } from "vitest";

import { heartOrbit } from "@/lib/live-hearts";

describe("カード周りのハート", () => {
  it("同じ位置に重ならず、ラベル中心から離れる", () => {
    const first = heartOrbit(1);
    const second = heartOrbit(2);
    expect(Math.hypot(first.dx, first.dy)).toBeGreaterThan(30);
    expect(Math.hypot(first.dx - second.dx, first.dy - second.dy)).toBeGreaterThan(10);
  });
});
