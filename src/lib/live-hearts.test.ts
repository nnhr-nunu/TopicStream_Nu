import { describe, expect, it } from "vitest";

import { frameHeartOrbit, heartOrbit } from "@/lib/live-hearts";

describe("カード周りのハート", () => {
  it("同じ位置に重ならず、ラベル中心から離れる", () => {
    const first = heartOrbit(1);
    const second = heartOrbit(2);
    expect(Math.hypot(first.dx, first.dy)).toBeGreaterThan(30);
    expect(Math.hypot(first.dx - second.dx, first.dy - second.dy)).toBeGreaterThan(10);
  });

  it("枠ハートはラベル中心を覆わず、枠の外に並ぶ", () => {
    const slots = [0, 1, 2, 3, 4, 5, 6, 7].map((slot) => frameHeartOrbit(slot));
    for (const orbit of slots) {
      expect(Math.abs(orbit.dx) > 28 || Math.abs(orbit.dy) > 28).toBe(true);
      expect(Math.abs(orbit.dx) < 22 && Math.abs(orbit.dy) < 22).toBe(false);
    }
    expect(Math.abs(frameHeartOrbit(1).dy)).toBeGreaterThan(40);
  });
});
