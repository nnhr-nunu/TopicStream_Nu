import { describe, expect, it } from "vitest";

import { formatHeartCount, totalHearts } from "@/lib/live-hearts";

describe("カードのハート数", () => {
  it("クリックのハートとコメントのハートを合算する", () => {
    expect(totalHearts({})).toBe(0);
    expect(totalHearts({ heartCount: 1 })).toBe(1);
    expect(totalHearts({ heartCount: 1, frameHearts: 11 })).toBe(12);
  });

  it("大きい数は短く表す", () => {
    expect(formatHeartCount(7)).toBe("7");
    expect(formatHeartCount(999)).toBe("999");
    expect(formatHeartCount(1234)).toBe("1.2k");
    expect(formatHeartCount(9999)).toBe("9.9k");
  });
});
