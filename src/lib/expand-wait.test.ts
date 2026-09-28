import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPacer, WAIT_QUIPS, waitNote } from "@/lib/expand-wait";

describe("createPacer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("最初はすぐ出し、続きは間隔をあけて1つずつ出す", async () => {
    const pacer = createPacer(200, () => Date.now());
    const seen: string[] = [];
    for (const label of ["a", "b", "c"]) pacer.push(() => seen.push(label));
    expect(seen).toEqual(["a"]);
    vi.advanceTimersByTime(199);
    expect(seen).toEqual(["a"]);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual(["a", "b"]);
    const drained = pacer.drain();
    vi.advanceTimersByTime(200);
    await drained;
    expect(seen).toEqual(["a", "b", "c"]);
  });

  it("間があいて届いた語は待たせない", () => {
    const pacer = createPacer(200, () => Date.now());
    const seen: string[] = [];
    pacer.push(() => seen.push("a"));
    vi.advanceTimersByTime(1_000);
    pacer.push(() => seen.push("b"));
    expect(seen).toEqual(["a", "b"]);
  });

  it("cancel で並んだ分を捨て、待っている drain も終わる", async () => {
    const pacer = createPacer(200, () => Date.now());
    const seen: string[] = [];
    pacer.push(() => seen.push("a"));
    pacer.push(() => seen.push("b"));
    const drained = pacer.drain();
    pacer.cancel();
    await drained;
    vi.advanceTimersByTime(1_000);
    expect(seen).toEqual(["a"]);
  });
});

describe("waitNote", () => {
  it("10秒までは何も出さない", () => {
    expect(waitNote(9_999, undefined)).toBeNull();
    expect(waitNote(9_999, "retry")).toBeNull();
  });

  it("状況に合わせた見出しと、入れ替わる一言を出す", () => {
    expect(waitNote(10_000, undefined)?.title).toContain("考えています（10秒）");
    expect(waitNote(12_000, "switch")?.title).toContain("別の AI");
    expect(waitNote(20_000, "retry")?.title).toContain("もう一度");
    expect(waitNote(40_000, "retry")?.title).toContain("もう少し");
    expect(waitNote(10_000, undefined)?.quip).toBe(WAIT_QUIPS[0]);
    expect(waitNote(14_000, undefined)?.quip).toBe(WAIT_QUIPS[1]);
    expect(waitNote(10_000, undefined, 3)?.quip).toBe(WAIT_QUIPS[3]);
  });
});
