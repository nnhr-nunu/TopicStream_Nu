/**
 * リアルな絵の動き: 空のカードを窓に見立てて、カードの中の床を歩く。
 * 3×3 なら同じ行のカードを通り抜けていく（語の入ったカードの後ろは見えない）。行の端から出たら、
 * 見えないところで別の行へ回り込み、反対向きに戻ってくる。画面側で空のカードの形に切り抜いて見せる
 */
import {
  cardRows,
  distance,
  pick,
  queue,
  stay,
  within,
  type CritterMove,
  type PlanContext,
  type Planner,
  type Rand,
} from "@/lib/critter-moves";
import type { CritterCard, Pt } from "@/lib/wait-critters";

/** 横に並んだカードの行。windows は空のカード（中が見える）の左右 */
export type Lane = { top: number; h: number; left: number; right: number; windows: { x0: number; x1: number }[] };

/** 床の高さ（カードの下の縁からどれだけ上か） */
export const FLOOR_INSET = 7;

/** 空のカードがある行 */
export function windowLanes(cards: CritterCard[]): Lane[] {
  return cardRows(cards)
    .map((row) => {
      const items = row.map((index) => cards[index]!);
      return {
        top: Math.min(...items.map((card) => card.y)),
        h: Math.max(...items.map((card) => card.h)),
        left: Math.min(...items.map((card) => card.x)),
        right: Math.max(...items.map((card) => card.x + card.w)),
        windows: items.filter((card) => card.empty).map((card) => ({ x0: card.x, x1: card.x + card.w })),
      };
    })
    .filter((lane) => lane.windows.length > 0);
}

export const floorOf = (lane: Lane) => lane.top + lane.h - FLOOR_INSET;

export type WindowSpec = {
  /** 1 秒あたりの速さ（盤面の座標で） */
  speed: number;
  gait: string;
  /** 動く高さ（無ければ床。泳ぐ・飛ぶものは上に） */
  line?: (lane: Lane) => number;
  /** 1回通り抜けるあいだに立ち止まる回数（最小・最大） */
  stops: [number, number];
  /** 立ち止まったときの動き（その場で跳ねる・降りる などで場所が変わってもよい） */
  rest: (at: Pt, rand: Rand, flip: boolean, lane: Lane) => CritterMove[];
  /** 跳んで進む（カエル・うさぎ・スズメ・リス） */
  hops?: { step: number; height: number; ms: number; breath: number; gait?: string };
};

/** 1区間の進み方（歩く / 跳ぶ） */
function travel(from: Pt, to: Pt, flip: boolean, spec: WindowSpec): CritterMove[] {
  const hops = spec.hops;
  if (!hops) return [{ from, to, ms: Math.max(250, (distance(from, to) / spec.speed) * 1000), gait: spec.gait, flip }];
  const count = Math.max(1, Math.round(Math.abs(to.x - from.x) / hops.step));
  const moves: CritterMove[] = [];
  let at = from;
  for (let index = 1; index <= count; index += 1) {
    const next = { x: from.x + ((to.x - from.x) * index) / count, y: to.y };
    moves.push({ from: at, to: next, ms: hops.ms, gait: hops.gait ?? "hop", hop: hops.height, flip });
    if (hops.breath > 0) moves.push(stay(next, hops.breath, "sit", { flip }));
    at = next;
  }
  return moves;
}

/**
 * size は先頭の絵の大きさ、trail は後ろについて歩く子の列の長さ（盤面の座標で）。
 * どちらも窓の外で完全に隠れてから向きを変えるのに使う
 */
export function windowPlanner(
  { cards, rand, size, trail = 0 }: PlanContext & { size: { w: number; h: number }; trail?: number },
  spec: WindowSpec,
): Planner {
  let lane = -1;
  let at: Pt | null = null;
  let dir = rand() < 0.5 ? 1 : -1;
  const half = size.w / 2;
  return {
    next: queue(() => {
      const lanes = windowLanes(cards());
      if (lanes.length === 0) return [stay(at ?? { x: 0, y: 0 }, 600, spec.gait, { flip: dir < 0 })];
      const choices = lanes.map((_, index) => index).filter((index) => lanes.length === 1 || index !== lane);
      lane = pick(choices, rand);
      const row = lanes[lane]!;
      const y = spec.line?.(row) ?? floorOf(row);
      const flip = dir < 0;
      const outside = half + 8;
      const start = { x: dir > 0 ? row.left - outside : row.right + outside, y };
      const end = { x: dir > 0 ? row.right + outside + trail : row.left - outside - trail, y };
      const moves: CritterMove[] = [];
      // 前の行の端から、見えないところを回り込む（速めに）
      if (at) moves.push({ from: at, to: start, ms: Math.max(200, (distance(at, start) / (spec.speed * 2.5)) * 1000), gait: spec.gait, flip });
      at = start;
      const count = spec.stops[0] + Math.floor(rand() * (spec.stops[1] - spec.stops[0] + 1));
      const stops = Array.from({ length: count }, () => {
        const window = pick(row.windows, rand);
        return within(rand, window.x0 + half + 4, Math.max(window.x0 + half + 4, window.x1 - half - 4));
      }).sort((a, b) => (a - b) * dir);
      for (const x of stops) {
        if ((x - at.x) * dir <= 0) continue;
        const to = { x, y };
        moves.push(...travel(at, to, flip, spec));
        const rest = spec.rest(to, rand, flip, row);
        moves.push(...rest);
        at = rest.length > 0 ? rest[rest.length - 1]!.to : to;
      }
      moves.push(...travel(at, end, flip, spec));
      at = end;
      dir = -dir;
      return moves;
    }),
  };
}

/** 動物ごとの、カードの中での動き */
export function realPlanner(kind: string, context: PlanContext & { size: { w: number; h: number }; trail?: number }): Planner {
  const { rand } = context;
  const spec = ((): WindowSpec => {
    switch (kind) {
      case "frog":
        return {
          speed: 60,
          gait: "jump",
          stops: [1, 2],
          hops: { step: 34, height: 16, ms: 440, breath: 520, gait: "jump" },
          rest: (at, _, flip) => [stay(at, within(rand, 1600, 3000), "sit", { flip })],
        };
      case "rabbit":
        return {
          speed: 80,
          gait: "hop",
          stops: [1, 3],
          hops: { step: 28, height: 11, ms: 300, breath: 130 },
          rest: (at, _, flip) => [stay(at, within(rand, 1000, 2200), "rest", { flip })],
        };
      case "bird":
        return {
          speed: 60,
          gait: "hop",
          stops: [2, 3],
          hops: { step: 13, height: 5, ms: 190, breath: 80 },
          // ついばむか、少しだけ飛び上がって降りる
          rest: (at, _, flip) => {
            if (rand() < 0.7) return [stay(at, within(rand, 700, 1400), "peck", { flip })];
            const dir = flip ? -1 : 1;
            const to = { x: at.x + dir * within(rand, 30, 50), y: at.y };
            return [{ from: at, to, ms: 650, gait: "fly", hop: 22, flip }, stay(to, 300, "sit", { flip })];
          },
        };
      case "squirrel":
        return {
          speed: 110,
          gait: "run",
          stops: [1, 2],
          hops: { step: 26, height: 7, ms: 200, breath: 0, gait: "run" },
          rest: (at, _, flip) => [stay(at, within(rand, 1300, 2300), "sit", { flip })],
        };
      case "hamster":
        return {
          speed: 52,
          gait: "run",
          stops: [2, 3],
          rest: (at, _, flip) => [stay(at, within(rand, 700, 1400), "sit", { flip })],
        };
      case "butterfly":
        return {
          speed: 36,
          gait: "fly",
          line: (lane) => lane.top + lane.h * 0.42,
          stops: [1, 2],
          // 床に降りて羽を休め、また舞い上がる
          rest: (at, _, flip, lane) => {
            const ground = { x: at.x + (flip ? -8 : 8), y: floorOf(lane) };
            return [
              { from: at, to: ground, ms: 800, gait: "fly", ease: true, flip },
              stay(ground, within(rand, 1400, 2400), "rest", { flip }),
              { from: ground, to: at, ms: 800, gait: "fly", ease: true, flip },
            ];
          },
        };
      case "goldfish":
        return {
          speed: 26,
          gait: "swim",
          line: (lane) => lane.top + lane.h * 0.55,
          stops: [1, 2],
          rest: (at, _, flip) => [
            stay(at, within(rand, 1000, 1800), "hover", {
              flip,
              emit: [
                { kind: "bubble", dx: flip ? -14 : 14, dy: -8, delay: 150 },
                { kind: "bubble", dx: flip ? -16 : 16, dy: -12, delay: 700 },
              ],
            }),
          ],
        };
      case "dolphin":
        return {
          speed: 46,
          gait: "swim",
          line: (lane) => lane.top + lane.h * 0.72,
          stops: [1, 2],
          // 水面から跳ねて、少し先へ潜る
          rest: (at, _, flip) => {
            const dir = flip ? -1 : 1;
            const to = { x: at.x + dir * 44, y: at.y };
            return [
              { from: at, to, ms: 900, gait: "leap", hop: 34, arcTilt: true, flip, emit: [{ kind: "splash", dy: -12 }, { kind: "splash", at: { x: to.x, y: to.y - 12 }, delay: 860 }] },
            ];
          },
        };
      case "penguin":
        return {
          speed: 20,
          gait: "walk",
          stops: [1, 2],
          // 立ち止まって、きょろきょろ
          rest: (at, _, flip) => [
            stay(at, within(rand, 700, 1300), "stand", { flip }),
            stay(at, within(rand, 500, 900), "stand", { flip: !flip }),
            stay(at, 300, "stand", { flip }),
          ],
        };
      case "chicks":
        return {
          speed: 24,
          gait: "walk",
          stops: [1, 2],
          rest: (at, _, flip) => [stay(at, within(rand, 1400, 2400), "peck", { flip })],
        };
      case "cat":
        return {
          speed: 28,
          gait: "walk",
          stops: [1, 2],
          rest: (at, _, flip) => [stay(at, within(rand, 1600, 3200), "sit", { flip })],
        };
      case "dog":
        return {
          speed: 46,
          gait: "walk",
          stops: [1, 2],
          rest: (at, _, flip) => [stay(at, within(rand, 1300, 2300), "sit", { flip })],
        };
      case "horse":
        return {
          speed: 95,
          gait: "run",
          stops: [0, 1],
          rest: (at, _, flip) => [stay(at, within(rand, 1800, 3000), "graze", { flip })],
        };
      default:
        // きつねとたぬき
        return {
          speed: 32,
          gait: "walk",
          stops: [1, 2],
          rest: (at, _, flip) => [stay(at, within(rand, 1800, 2800), "rest", { flip })],
        };
    }
  })();
  return windowPlanner(context, spec);
}
