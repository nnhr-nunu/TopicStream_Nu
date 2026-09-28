import { describe, expect, it } from "vitest";

import { castFor, CRITTER_ICONS } from "@/lib/critter-cast";
import { cutePlanner, gridStep, nextFrogMove, perch, type CritterMove } from "@/lib/critter-moves";
import { floorOf, realPlanner, windowLanes } from "@/lib/critter-moves-window";
import { spriteRuns, type Sprite } from "@/lib/critter-sprite";
import { CUTE_SPRITES } from "@/lib/critter-sprites-cute";
import { realSprites } from "@/lib/critter-sprites-real";
import {
  CRITTER_KINDS,
  critterPaths,
  pickCritter,
  previewGroup,
  waitingGroups,
  type CritterCard,
  type CritterNode,
} from "@/lib/wait-critters";

/** 幅 100・高さ 40 のカードを 20 空けて 3×3 に並べる（左上が 0,0）。中心が語の入ったもとのカード、周りは空 */
function grid(): CritterCard[] {
  return Array.from({ length: 9 }, (_, cell) => ({
    x: (cell % 3) * 120,
    y: Math.floor(cell / 3) * 60,
    w: 100,
    h: 40,
    cell,
    ...(cell === 4 ? { center: true } : { empty: true }),
  }));
}

/** 決まった順に値を返す乱数 */
function seq(...values: number[]) {
  let index = 0;
  return () => values[index++ % values.length]!;
}

/** ずっと同じ並びにならない、再現できる乱数 */
function seeded(seed = 7) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function take(next: () => CritterMove, count: number): CritterMove[] {
  return Array.from({ length: count }, () => next());
}

describe("絵", () => {
  const all: [string, Sprite][] = [...Object.entries(CUTE_SPRITES), ...Object.entries(realSprites())];

  it("どのコマも同じ大きさで、色の決まっていない文字を使わない", () => {
    for (const [name, { palette, frames }] of all) {
      const rows = Object.values(frames);
      const width = rows[0]![0]!.length;
      for (const frame of rows) {
        expect(frame.length, name).toBe(rows[0]!.length);
        for (const row of frame) {
          expect(row.length, `${name}: ${row}`).toBe(width);
          for (const char of row) expect(char === "." || char in palette, `${name}: ${char}`).toBe(true);
        }
      }
    }
  });

  it("配役の動きが使うコマは、どれも絵にある", () => {
    for (const kind of CRITTER_KINDS) {
      for (const style of ["cute", "real"] as const) {
        for (const actor of castFor(kind, style).actors) {
          for (const [name, gait] of Object.entries(actor.gaits)) {
            for (const frame of gait.frames) expect(gait.sprite.frames[frame], `${kind}/${style}/${name}/${frame}`).toBeDefined();
          }
        }
      }
      for (const icon of CRITTER_ICONS[kind]) expect(icon.sprite.frames[icon.frame], kind).toBeDefined();
    }
  });

  it("どの動物も、動きが使う絵の動かし方（gait）が配役にある", () => {
    const cards = grid();
    for (const kind of CRITTER_KINDS) {
      for (const style of ["cute", "real"] as const) {
        const gaits = castFor(kind, style).actors[0]!.gaits;
        const context = { cards: () => cards, rand: seeded(11), size: { w: 40, h: 30 }, trail: 40 };
        const planner = style === "real" ? realPlanner(kind, context) : cutePlanner(kind, context);
        const moves = [...take(planner.next, 150), ...(planner.finale?.() ?? [])];
        for (const move of moves) expect(gaits[move.gait], `${kind}/${style}: ${move.gait}`).toBeDefined();
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
});

describe("どの動物を出すか", () => {
  it("同じ待ちには同じ動物が出て、いろいろな動物が出る", () => {
    expect(pickCritter("a,b,c", [], "mix")).toEqual(pickCritter("a,b,c", [], "mix"));
    const kinds = new Set(Array.from({ length: 200 }, (_, index) => pickCritter(`n-${index}`, [], "mix")!.kind));
    expect(kinds.size).toBe(CRITTER_KINDS.length);
    const styles = new Set(Array.from({ length: 40 }, (_, index) => pickCritter(`n-${index}`, [], "mix")!.style));
    expect([...styles].sort()).toEqual(["cute", "real"]);
  });

  it("しまった動物は出ず、全部しまえば出ない。タッチを決めればそれだけ", () => {
    const hidden = CRITTER_KINDS.filter((kind) => kind !== "cat");
    for (let index = 0; index < 20; index += 1) expect(pickCritter(`s${index}`, hidden, "real")).toEqual({ kind: "cat", style: "real" });
    expect(pickCritter("x", [...CRITTER_KINDS], "mix")).toBeNull();
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
    expect(groups[0]!.seed).toBe("a,b,center");
    expect(groups[0]!.cards.map((card) => [card.x, Boolean(card.empty), Boolean(card.center)])).toEqual([
      [350, false, true],
      [470, true, false],
      [590, true, false],
    ]);
  });

  it("大きさがまだ測れていなければ出さない", () => {
    const nodes = [node("p", null, 0), node("a", "p", 120, { placeholder: true }, false)];
    expect(waitingGroups(nodes)).toEqual([]);
  });

  it("試しに出すときは、選んでいるカードの 3×3 の中心の周りを空のカードとして扱う", () => {
    const nodes = [
      node("c", null, 0, { groupId: 0, cellIndex: 4 }),
      node("k", "c", 120, { groupId: 0, cellIndex: 5 }),
      node("far", null, 900, { groupId: 1, cellIndex: 4 }),
    ];
    const group = previewGroup(nodes, "k", 4);
    expect(group?.key).toBe("c");
    expect(group?.cards.map((card) => Boolean(card.empty))).toEqual([false, true]);
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

  it("格子の隣の角へ進み、行き止まりでなければ来た道を戻らない", () => {
    const paths = critterPaths(grid());
    const rand = seeded();
    let state: Parameters<typeof gridStep>[0] = { i: 1, j: 0, from: { i: 0, j: 0 } };
    for (let step = 0; step < 60; step += 1) {
      const next = gridStep(state, paths, rand);
      expect(Math.abs(next.i - state.i) + Math.abs(next.j - state.j)).toBe(1);
      if (state.from) expect(next).not.toMatchObject({ i: state.from.i, j: state.from.j });
      state = { i: next.i, j: next.j, from: { i: state.i, j: state.j } };
    }
  });
});

describe("かわいい絵の動き", () => {
  const context = (cards = grid(), rand = seeded()) => ({ cards: () => cards, rand });

  it("カエルは休んでから、別のカードの上の縁へ跳ぶ", () => {
    const cards = grid();
    const start = { card: 4, at: perch(cards[4]!, 0.5), resting: false };
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

  it("ペンギンは横は横向き（左へは反転、たまにお腹で滑る）、下へは正面、上へは後ろ姿", () => {
    const moves = take(cutePlanner("penguin", context()).next, 200);
    for (const move of moves) {
      const dx = move.to.x - move.from.x;
      const dy = move.to.y - move.from.y;
      if (dx === 0 && dy === 0) {
        expect(move.gait).toMatch(/^idle(Side|Front|Back)$/);
      } else if (dx !== 0) {
        expect(["walkSide", "slide"]).toContain(move.gait);
        expect(move.flip).toBe(dx < 0);
      } else {
        expect(move.gait).toBe(dy > 0 ? "walkFront" : "walkBack");
      }
    }
    expect(new Set(moves.map((move) => move.gait)).size).toBeGreaterThanOrEqual(6);
  });

  it("うまは外周だけを回る", () => {
    const cards = grid();
    const { xs, ys } = critterPaths(cards);
    for (const move of take(cutePlanner("horse", context(cards)).next, 80)) {
      const onRing = (x: number, y: number) => x === xs[0] || x === xs[3] || y === ys[0] || y === ys[3];
      expect(onRing(move.to.x, move.to.y)).toBe(true);
    }
  });

  it("うさぎは同じ行ならカードの上に降り、溝の上には降りない", () => {
    const cards = grid();
    for (const move of take(cutePlanner("rabbit", context(cards)).next, 300)) {
      if (move.gait !== "hop" || move.from.y !== move.to.y) continue;
      const row = cards.filter((card) => Math.abs(card.y + 2 - move.to.y) < 0.01);
      expect(row.some((card) => move.to.x >= card.x && move.to.x <= card.x + card.w)).toBe(true);
    }
  });

  it("リスは空のカードに1個ずつどんぐりを置く（同じカードに2個置かない）", () => {
    const cards = grid();
    const acorns = take(cutePlanner("squirrel", context(cards)).next, 200)
      .flatMap((move) => move.emit ?? [])
      .filter((emit) => emit.kind === "acorn");
    expect(acorns.map((emit) => emit.card).sort()).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
    for (const emit of acorns) {
      const card = cards[emit.card!]!;
      expect(emit.at!.x).toBeGreaterThan(card.x);
      expect(emit.at!.x).toBeLessThan(card.x + card.w);
      expect(emit.at!.y).toBeLessThanOrEqual(card.y + card.h);
    }
  });

  it("小鳥は中心のカードの縁でさえずり（音符）、終わると上へ飛び立つ", () => {
    const cards = grid();
    const planner = cutePlanner("bird", context(cards));
    const moves = take(planner.next, 60);
    for (const move of moves) expect(move.to.y).toBeCloseTo(cards[4]!.y + 2);
    expect(moves.some((move) => move.gait === "chirp" && move.emit?.some((emit) => emit.kind === "note"))).toBe(true);
    const [fly] = planner.finale!();
    expect(fly!.gait).toBe("fly");
    expect(fly!.to.y).toBeLessThan(fly!.from.y - 100);
  });

  it("蝶々は語の入ったカードにだけ停まり、終わると語が入ったばかりのカードに停まる", () => {
    const cards = grid();
    const planner = cutePlanner("butterfly", context(cards));
    const moves = take(planner.next, 80);
    const rests = moves.filter((move) => move.gait === "rest");
    expect(rests.length).toBeGreaterThan(0);
    const on = (at: CritterMove["to"]) => cards.findIndex((card) => at.x >= card.x && at.x <= card.x + card.w && Math.abs(at.y - card.y - 12) < 0.01);
    for (const rest of rests) expect(on(rest.to)).toBe(4);
    const finale = planner.finale!();
    expect(cards[on(finale.at(-1)!.to)]!.empty).toBe(true);
  });
});

describe("リアルな絵の動き（カードの中）", () => {
  it("空のカードがある行だけを歩く", () => {
    const cards = grid().map((card) => (card.cell! < 3 ? { ...card, empty: false } : card));
    expect(windowLanes(cards).map((lane) => lane.top)).toEqual([60, 120]);
  });

  it("床を歩いて行の外から入って外へ抜け、立ち止まるのは空のカードの中", () => {
    const cards = grid();
    const lanes = windowLanes(cards);
    const floors = lanes.map(floorOf);
    const planner = realPlanner("cat", { cards: () => cards, rand: seeded(3), size: { w: 40, h: 26 } });
    const moves = take(planner.next, 120);
    for (const move of moves) {
      if (move.from.y !== move.to.y) continue;
      expect(floors).toContain(move.to.y);
      if (move.gait === "sit") {
        const inside = cards.some((card) => card.empty && move.to.x > card.x + 20 && move.to.x < card.x + card.w - 20);
        expect(inside).toBe(true);
      }
    }
    const xs = moves.map((move) => move.to.x);
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(Math.max(...xs)).toBeGreaterThan(340);
  });
});
