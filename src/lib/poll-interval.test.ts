import { describe, expect, it } from "vitest";

import { nextWatchPollMs, nextYoutubePollMs } from "@/lib/poll-interval";

describe("nextYoutubePollMs", () => {
  it("コメントが続いている間はふだんの間隔、40 秒ほど静かなら 16 秒にする", () => {
    expect(nextYoutubePollMs(8_000, 0)).toBe(8_000);
    expect(nextYoutubePollMs(8_000, 4)).toBe(8_000);
    expect(nextYoutubePollMs(8_000, 5)).toBe(16_000);
    expect(nextYoutubePollMs(undefined, 9)).toBe(16_000);
  });

  it("YouTube が指定した間隔より短くしない", () => {
    expect(nextYoutubePollMs(20_000, 0)).toBe(20_000);
    expect(nextYoutubePollMs(20_000, 9)).toBe(20_000);
  });
});

describe("nextWatchPollMs", () => {
  it("OBS に映す画面はいつも 2.5 秒、見る人の画面は盤面が変わらない間だけ 5 秒", () => {
    expect(nextWatchPollMs(10, true)).toBe(2_500);
    expect(nextWatchPollMs(3, false)).toBe(2_500);
    expect(nextWatchPollMs(4, false)).toBe(5_000);
    expect(nextWatchPollMs(0, false)).toBe(2_500);
  });
});
