import { describe, expect, it } from "vitest";

import {
  CRITTER_KINDS,
  critterFor,
  critterPaths,
  frogPerch,
  nextFrogMove,
  nextPenguinMove,
  previewGroup,
  SPRITES,
  spriteRuns,
  waitingGroups,
  type CritterCard,
  type CritterNode,
} from "@/lib/wait-critters";

/** 幅 100・高さ 40 のカードを 20 空けて 3×3 に並べる（左上が 0,0） */
function grid(): CritterCard[] {
  return Array.from({ length: 9 }, (_, cell) => ({
    x: (cell % 3) * 120,
    y: Math.floor(cell / 3) * 60,
    w: 100,
    h: 40,
    cell,
  }));
}

/** 決まった順に値を返す乱数 */
function seq(...values: number[]) {
  let index = 0;
  return () => values[index++ % values.length]!;
}

describe("絵", () => {
  it("どのコマも同じ大きさで、色の決まっていない文字を使わない", () => {
    for (const kind of CRITTER_KINDS) {
      const { palette, frames } = SPRITES[kind];
      const rows = Object.values(frames);
      const width = rows[0]![0]!.length;
      for (const frame of rows) {
        expect(frame.length).toBe(rows[0]!.length);
        for (const row of frame) {
          expect(row.length).toBe(width);
          for (const char of row) expect(char === "." || char in palette).toBe(true);
        }
      }
    }
  });

  it("横に続く同じ色は1つの長方形にまとめる", () => {
    expect(spriteRuns([".AAB", "A..."], { A: "red", B: "blue" })).toEqual([
      { x: 1, y: 0, w: 2, fill: "red" },
      { x: 3, y: 0, w: 1, fill: "blue" },
      { x: 0, y: 1, w: 1, fill: "red" },
    ]);
  });

  it("同じ待ちには同じ動物が出る", () => {
    expect(critterFor("n-abc")).toBe(critterFor("n-abc"));
    const kinds = new Set(Array.from({ length: 40 }, (_, index) => critterFor(`n-${index}`)));
    expect(kinds.size).toBe(CRITTER_KINDS.length);
  });
});

describe("待っている盤面", () => {
  const node = (id: string, parentId: string | null, x: number, extra: Partial<CritterNode["data"]> = {}, measured = true): CritterNode => ({
    id,
    position: { x, y: 0 },
    ...(measured ? { measured: { width: 100, height: 40 } } : {}),
    data: { parentId, ...extra },
  });

  it("空のカードの親と、その子のカードを1つの範囲にする（ほかの 3×3 は入れない）", () => {
    const nodes = [
      node("root", null, 0),
      node("old", "root", 200),
      node("center", "old", 400, { cellIndex: 4 }),
      node("a", "center", 520, { placeholder: true, cellIndex: 0 }),
      node("b", "center", 640, { placeholder: true, cellIndex: 1 }),
    ];
    const groups = waitingGroups(nodes);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.key).toBe("center");
    expect(groups[0]!.cards.map((card) => card.x)).toEqual([350, 470, 590]);
  });

  it("大きさがまだ測れていなければ出さない", () => {
    const nodes = [node("p", null, 0), node("a", "p", 120, { placeholder: true }, false)];
    expect(waitingGroups(nodes)).toEqual([]);
  });

  it("試しに出すときは、選んでいるカードの 3×3 の中心の周り", () => {
    const nodes = [
      node("c", null, 0, { groupId: 0, cellIndex: 4 }),
      node("k", "c", 120, { groupId: 0, cellIndex: 5 }),
      node("far", null, 900, { groupId: 1, cellIndex: 4 }),
    ];
    expect(previewGroup(nodes, "k", 4)?.key).toBe("c");
  });
});

describe("道", () => {
  it("3×3 ならカードの間の溝と外周を通る", () => {
    const { xs, ys } = critterPaths(grid());
    expect(xs.slice(1, 3)).toEqual([110, 230]);
    expect(ys.slice(1, 3)).toEqual([50, 110]);
    expect(xs[0]!).toBeLessThan(0);
    expect(xs[3]!).toBeGreaterThan(340);
  });

  it("3×3 でなければ外周だけ", () => {
    const { xs, ys } = critterPaths(grid().slice(0, 4).map((card) => ({ ...card, cell: undefined })));
    expect(xs).toHaveLength(2);
    expect(ys).toHaveLength(2);
  });
});

describe("動き", () => {
  it("カエルは休んでから、別のカードの上の縁へ跳ぶ", () => {
    const cards = grid();
    const start = { card: 4, at: frogPerch(cards[4]!, () => 0.5), resting: false };
    const rest = nextFrogMove(start, cards, seq(0.5));
    expect(rest.move.from).toEqual(rest.move.to);
    expect(rest.move.hop).toBeUndefined();

    const jump = nextFrogMove(rest.state, cards, seq(0.5));
    expect(jump.state.card).not.toBe(4);
    expect(jump.move.hop).toBeGreaterThan(0);
    const target = cards[jump.state.card]!;
    expect(jump.move.to.y).toBeCloseTo(target.y + 2);
    expect(jump.move.to.x).toBeGreaterThan(target.x);
    expect(jump.move.to.x).toBeLessThan(target.x + target.w);
  });

  it("ペンギンは格子の隣の角へ歩き、行き止まりでなければ来た道を戻らない", () => {
    const paths = critterPaths(grid());
    let state: Parameters<typeof nextPenguinMove>[0] = { i: 1, j: 0, from: { i: 0, j: 0 } };
    for (let step = 0; step < 50; step += 1) {
      const before = state;
      const next = nextPenguinMove(state, paths, seq(0.9, 0.1, 0.6, 0.3));
      state = next.state;
      if (next.move.from.x === next.move.to.x && next.move.from.y === next.move.to.y) continue;
      expect(Math.abs(state.i - before.i) + Math.abs(state.j - before.j)).toBe(1);
      expect(state.i).toBeGreaterThanOrEqual(0);
      expect(state.i).toBeLessThan(paths.xs.length);
      expect(state.j).toBeGreaterThanOrEqual(0);
      expect(state.j).toBeLessThan(paths.ys.length);
      if (before.from) expect(state).not.toMatchObject({ i: before.from.i, j: before.from.j });
    }
  });

  it("ペンギンは横に歩くとき横向き（左へは反転）、下へは正面、上へは後ろ姿", () => {
    const paths = critterPaths(grid());
    const poses = new Map<string, { flip?: boolean }>();
    // 最初の乱数 0.9 で立ち止まらず、次の乱数で残った向き（右 → 左 → 下 → 上の順から来た道を除く）を選ぶ
    for (const [from, choice] of [
      [{ i: 2, j: 1 }, 0],
      [{ i: 0, j: 1 }, 0],
      [{ i: 2, j: 1 }, 0.4],
      [{ i: 2, j: 1 }, 0.8],
    ] as const) {
      const move = nextPenguinMove({ i: 1, j: 1, from }, paths, seq(0.9, choice)).move;
      poses.set(`${move.pose}:${move.flip ?? ""}`, move);
    }
    expect([...poses.keys()].sort()).toEqual(["back:false", "front:false", "side:false", "side:true"].sort());
  });
});
