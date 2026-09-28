/**
 * 待ち時間の動物の動き（次にどこへ・どの絵で・何ミリ秒かけて動くか）。
 * かわいい絵はカードの上の縁や、カードの間の溝を歩く。リアルな絵は critter-moves-window.ts（カードの中）。
 * どれも乱数とカードの位置だけで決まる計算（画面は wait-critters.tsx）
 */
import { cardsBounds, critterPaths, type CritterCard, type CritterPaths, type Pt } from "@/lib/wait-critters";

export type Rand = () => number;

export type EmitKind = "note" | "z" | "bubble" | "heart" | "splash" | "acorn";

/** 動き出したときに飛ばす小物（音符・寝息・泡・ハート・水しぶき・どんぐり） */
export type Emit = {
  kind: EmitKind;
  /** 出す位置（動物の足元からのずれ）。at があればそこ（盤面の座標） */
  dx?: number;
  dy?: number;
  at?: Pt;
  /** 動き出してから出すまで（ms） */
  delay?: number;
  /** どの動物の位置から出すか（0 が先頭。行列の後ろの子なら 1〜） */
  actor?: number;
  /** どんぐりを置いたカード（範囲のカードの番号。そのカードに語が入ったら消す） */
  card?: number;
};

/** 1回分の動き。from → to を ms かけて進む */
export type CritterMove = {
  from: Pt;
  to: Pt;
  ms: number;
  /** 絵の動かし方（critter-cast.ts の gaits の名前） */
  gait: string;
  /** 弧の高さ（跳ぶとき） */
  hop?: number;
  /** 左向き（右向きの絵を反転）。無ければ前の向きのまま */
  flip?: boolean;
  /** 上から見た絵の向き（度。右が 0、下が 90）。無ければ前のまま */
  turn?: number;
  /** 弧に沿って絵を傾ける（跳ねるイルカ） */
  arcTilt?: boolean;
  /** ゆっくり動き出して、ゆっくり止まる（飛ぶもの） */
  ease?: boolean;
  emit?: Emit[];
};

export type Planner = {
  next: () => CritterMove;
  /** 待ちが終わったときの締めの動き（無ければその場で消える）。最初の from は画面側で今の位置に置き換える */
  finale?: () => CritterMove[];
};

/** cards は今のカード（動いている間に並びが変わることがあるので、毎回呼ぶ） */
export type PlanContext = { cards: () => CritterCard[]; rand: Rand };

// ---- 小さな道具 ----

export const pick = <T>(items: readonly T[], rand: Rand): T => items[Math.floor(rand() * items.length) % items.length]!;
export const distance = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const within = (rand: Rand, min: number, max: number) => min + rand() * (max - min);

export function stay(at: Pt, ms: number, gait: string, extra: Partial<CritterMove> = {}): CritterMove {
  return { from: at, to: at, ms, gait, ...extra };
}

/** カードの上の縁に座る場所（t は左端 0 〜 右端 1）。足を少し縁にかける */
export function perch(card: CritterCard, t: number): Pt {
  return { x: card.x + card.w * t, y: card.y + 2 };
}

/** 決まった動きを順に出し、なくなったら plan で次の一続きを作る */
export function queue(plan: () => CritterMove[]): () => CritterMove {
  let moves: CritterMove[] = [];
  return () => {
    while (moves.length === 0) moves = plan();
    return moves.shift()!;
  };
}

/** 上の縁の高さがそろったカードの並び（マンダラートなら3行）。中は左から順 */
export function cardRows(cards: CritterCard[]): number[][] {
  const rows: number[][] = [];
  const order = cards.map((card, index) => ({ card, index })).sort((a, b) => a.card.y - b.card.y);
  for (const { card, index } of order) {
    const row = rows.find((items) => Math.abs(cards[items[0]!]!.y - card.y) < 6);
    if (row) row.push(index);
    else rows.push([index]);
  }
  return rows.map((row) => row.sort((a, b) => cards[a]!.x - cards[b]!.x));
}

/** x を、並んだカードのどれかの上に寄せる（溝の上には降りない） */
export function snapToCards(x: number, cards: CritterCard[], pad = 8): number {
  let best = x;
  let gap = Infinity;
  for (const card of cards) {
    const clamped = Math.min(card.x + card.w - pad, Math.max(card.x + pad, x));
    if (Math.abs(clamped - x) < gap) {
      gap = Math.abs(clamped - x);
      best = clamped;
    }
  }
  return best;
}

/** 同じ行の縁の上を、ひと跳び step 以内で渡る着地点（最後が to） */
export function edgeHops(from: Pt, to: Pt, rowCards: CritterCard[], step: number): Pt[] {
  const count = Math.max(1, Math.round(Math.abs(to.x - from.x) / step));
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? to : { x: snapToCards(from.x + ((to.x - from.x) * (index + 1)) / count, rowCards), y: to.y },
  );
}

/** 近い順に数枚から選ぶ（たまに遠く） */
function nearbyCard(cards: CritterCard[], at: Pt, except: number, rand: Rand): number {
  const others = cards.map((card, index) => ({ card, index })).filter(({ index }) => index !== except);
  if (others.length === 0) return except;
  const near = [...others].sort((a, b) => distance(at, perch(a.card, 0.5)) - distance(at, perch(b.card, 0.5)));
  return (rand() < 0.2 ? pick(others, rand) : pick(near.slice(0, 3), rand)).index;
}

// ---- カエル: カードからカードへ跳ぶ ----

export type FrogState = { card: number; at: Pt; resting: boolean };

/** 着いたら少し休み（まばたきは絵の側）、たいてい近くのカード、たまに遠くへ大ジャンプ */
export function nextFrogMove(state: FrogState, cards: CritterCard[], rand: Rand): { move: CritterMove; state: FrogState } {
  if (!state.resting) {
    return { move: stay(state.at, within(rand, 900, 2200), "sit"), state: { ...state, resting: true } };
  }
  const target = nearbyCard(cards, state.at, state.card, rand);
  if (target === state.card) return { move: stay(state.at, 1200, "sit"), state };
  const to = perch(cards[target]!, within(rand, 0.22, 0.78));
  const far = distance(state.at, to);
  return {
    move: { from: state.at, to, ms: Math.min(1100, 420 + far * 0.9), gait: "jump", hop: 34 + far * 0.2 },
    state: { card: target, at: to, resting: false },
  };
}

function frogPlanner({ cards, rand }: PlanContext): Planner {
  const start = cards();
  const card = Math.floor(rand() * start.length);
  let frog: FrogState = { card, at: perch(start[card]!, within(rand, 0.22, 0.78)), resting: false };
  return {
    next: () => {
      const next = nextFrogMove(frog, cards(), rand);
      frog = next.state;
      return next.move;
    },
  };
}

// ---- 溝の格子を歩く（ペンギン・ひよこ・いぬ・金魚・イルカ・きつねとたぬき・うま） ----

export type GridState = { i: number; j: number; from?: { i: number; j: number } };
export type Heading = "right" | "left" | "down" | "up";

export const gridPoint = (paths: CritterPaths, i: number, j: number): Pt => ({ x: paths.xs[i]!, y: paths.ys[j]! });

/** 格子の隣の角へ。行き止まりでなければ来た道は戻らない。allow で通れる角を絞る（外周だけ など） */
export function gridStep(
  state: GridState,
  paths: CritterPaths,
  rand: Rand,
  allow: (i: number, j: number) => boolean = () => true,
): { i: number; j: number; heading: Heading } {
  const options = (
    [
      { i: state.i + 1, j: state.j, heading: "right" },
      { i: state.i - 1, j: state.j, heading: "left" },
      { i: state.i, j: state.j + 1, heading: "down" },
      { i: state.i, j: state.j - 1, heading: "up" },
    ] as const
  ).filter(
    (next) => next.i >= 0 && next.j >= 0 && next.i < paths.xs.length && next.j < paths.ys.length && allow(next.i, next.j),
  );
  const forward = options.filter((next) => !(state.from && next.i === state.from.i && next.j === state.from.j));
  return pick(forward.length > 0 ? forward : options, rand);
}

type GridSpec = {
  /** 1 秒あたりの速さ（盤面の座標で） */
  speed: number;
  gait: string;
  /** 角で立ち止まる割合 */
  pause: number;
  rest?: (at: Pt, rand: Rand, last: { flip: boolean; heading: Heading }) => CritterMove[];
  /** 歩く1区間の上書き（向きで絵を変える・跳ねる など） */
  step?: (move: CritterMove, heading: Heading, rand: Rand) => Partial<CritterMove>;
  /** 外周だけを回る */
  ring?: boolean;
};

function gridPlanner({ cards, rand }: PlanContext, spec: GridSpec): Planner {
  const first = critterPaths(cards());
  const last = (paths: CritterPaths) => ({ i: paths.xs.length - 1, j: paths.ys.length - 1 });
  const onRing = (paths: CritterPaths) => (i: number, j: number) =>
    i === 0 || j === 0 || i === last(paths).i || j === last(paths).j;
  let state: GridState = spec.ring
    ? { i: 0, j: Math.floor(rand() * first.ys.length) }
    : { i: Math.floor(rand() * first.xs.length), j: Math.floor(rand() * first.ys.length) };
  let flip = rand() < 0.5;
  let heading: Heading = flip ? "left" : "right";
  return {
    next: queue(() => {
      const paths = critterPaths(cards());
      // カードの並びが変わって道の数が減ったら、はみ出さないように寄せる
      state = { i: Math.min(state.i, last(paths).i), j: Math.min(state.j, last(paths).j), from: state.from };
      const at = gridPoint(paths, state.i, state.j);
      if (state.from && spec.rest && rand() < spec.pause) {
        state = { i: state.i, j: state.j };
        return spec.rest(at, rand, { flip, heading });
      }
      const step = gridStep(state, paths, rand, spec.ring ? onRing(paths) : undefined);
      const to = gridPoint(paths, step.i, step.j);
      heading = step.heading;
      if (heading === "left") flip = true;
      if (heading === "right") flip = false;
      state = { i: step.i, j: step.j, from: { i: state.i, j: state.j } };
      const move: CritterMove = { from: at, to, ms: Math.max(300, (distance(at, to) / spec.speed) * 1000), gait: spec.gait, flip };
      return [{ ...move, ...spec.step?.(move, heading, rand) }];
    }),
  };
}

const POSE: Record<Heading, "Side" | "Front" | "Back"> = { right: "Side", left: "Side", down: "Front", up: "Back" };
/** 上から見た絵を進む向きへ回す角度 */
export const TURN: Record<Heading, number> = { right: 0, down: 90, left: 180, up: -90 };

// ---- 縁の上を跳んで渡る（うさぎ・リス・ハムスター） ----

type EdgeSpec = {
  gait: string;
  /** ひと跳びの長さの上限と、弧の高さ・かける時間 */
  step: number;
  hop: (far: number) => number;
  ms: (far: number) => number;
  /** 跳ぶ合間に一息つく時間（0 なら続けて跳ぶ） */
  breath: number;
  /** 同じ行のカードへ行く割合（残りは別の行へ大きく跳ぶ） */
  sameRow: number;
};

/** 今いる場所から target へ縁を跳んで渡る動き。着いた場所と向きを返す */
function edgeTrip(
  cards: CritterCard[],
  from: { card: number; at: Pt; flip: boolean },
  target: { card: number; at: Pt },
  spec: EdgeSpec,
): { moves: CritterMove[]; at: Pt; flip: boolean } {
  const row = cardRows(cards).find((items) => items.includes(from.card)) ?? [from.card];
  const landing = row.includes(target.card)
    ? edgeHops(from.at, target.at, row.map((index) => cards[index]!), spec.step)
    : [target.at];
  const moves: CritterMove[] = [];
  let at = from.at;
  let flip = from.flip;
  for (const to of landing) {
    if (Math.abs(to.x - at.x) > 1) flip = to.x < at.x;
    const far = distance(at, to);
    moves.push({ from: at, to, ms: spec.ms(far), gait: spec.gait, hop: spec.hop(far), flip });
    if (spec.breath > 0) moves.push(stay(to, spec.breath, "sit", { flip }));
    at = to;
  }
  return { moves, at, flip };
}

function edgeTarget(cards: CritterCard[], from: number, spec: EdgeSpec, rand: Rand): { card: number; at: Pt } {
  const row = cardRows(cards).find((items) => items.includes(from)) ?? [from];
  const card = rand() < spec.sameRow ? pick(row, rand) : Math.floor(rand() * cards.length);
  return { card, at: perch(cards[card]!, within(rand, 0.15, 0.85)) };
}

const RABBIT_HOPS: EdgeSpec = {
  gait: "hop",
  step: 30,
  hop: (far) => 10 + far * 0.14,
  ms: (far) => Math.min(900, 260 + far * 1.6),
  breath: 110,
  sameRow: 0.75,
};

/** うさぎ: 縁をぴょんぴょん渡り、止まると耳をぴくっ（rest の絵） */
function rabbitPlanner({ cards, rand }: PlanContext): Planner {
  const start = cards();
  let card = Math.floor(rand() * start.length);
  let at = perch(start[card]!, within(rand, 0.25, 0.75));
  let flip = rand() < 0.5;
  return {
    next: queue(() => {
      const list = cards();
      const rest = stay(at, within(rand, 900, 2300), "rest", { flip });
      const target = edgeTarget(list, card, RABBIT_HOPS, rand);
      const trip = edgeTrip(list, { card, at, flip }, target, RABBIT_HOPS);
      ({ at, flip } = trip);
      card = target.card;
      return [rest, ...trip.moves];
    }),
  };
}

const SQUIRREL_BOUNDS: EdgeSpec = {
  gait: "run",
  step: 26,
  hop: (far) => 5 + far * 0.08,
  ms: (far) => Math.min(700, 150 + far * 2.4),
  breath: 0,
  sameRow: 0.6,
};

/** リス: 空のカードへ走っていき、どんぐりを1個ずつ置く。置き終わったら座ってかじる */
function squirrelPlanner({ cards, rand }: PlanContext): Planner {
  const start = cards();
  let card = Math.floor(rand() * start.length);
  let at = perch(start[card]!, within(rand, 0.3, 0.7));
  let flip = rand() < 0.5;
  const stocked = new Set<number>();
  return {
    next: queue(() => {
      const list = cards();
      const todo = list.map((item, index) => ({ item, index })).filter(({ item, index }) => item.empty && !stocked.has(index));
      if (todo.length === 0 && rand() < 0.65) return [stay(at, within(rand, 1500, 2600), "nibble", { flip })];
      const next =
        todo.length > 0
          ? todo.sort((a, b) => distance(at, perch(a.item, 0.5)) - distance(at, perch(b.item, 0.5)))[0]!.index
          : Math.floor(rand() * list.length);
      const target = { card: next, at: perch(list[next]!, within(rand, 0.3, 0.7)) };
      const trip = edgeTrip(list, { card, at, flip }, target, SQUIRREL_BOUNDS);
      ({ at, flip } = trip);
      card = next;
      const moves = [...trip.moves, stay(at, 350, "sit", { flip })];
      const box = list[next]!;
      if (box.empty && !stocked.has(next)) {
        stocked.add(next);
        const spot = { x: box.x + box.w * within(rand, 0.28, 0.72), y: box.y + box.h - 10 };
        moves.push(stay(at, 650, "sit", { flip, emit: [{ kind: "acorn", at: spot, card: next, delay: 120 }] }));
      }
      return moves;
    }),
  };
}

const HAMSTER_SCURRY: EdgeSpec = {
  gait: "run",
  step: 44,
  hop: () => 3,
  ms: (far) => Math.max(160, far * 11),
  breath: 0,
  sameRow: 0.85,
};

/** ハムスター: 縁をちょこまか走り、止まるとほお袋をもぐもぐ */
function hamsterPlanner({ cards, rand }: PlanContext): Planner {
  const start = cards();
  let card = Math.floor(rand() * start.length);
  let at = perch(start[card]!, within(rand, 0.25, 0.75));
  let flip = rand() < 0.5;
  return {
    next: queue(() => {
      const list = cards();
      const rest =
        rand() < 0.5 ? stay(at, within(rand, 1200, 2200), "munch", { flip }) : stay(at, within(rand, 450, 900), "sit", { flip });
      const target = edgeTarget(list, card, HAMSTER_SCURRY, rand);
      const trip = edgeTrip(list, { card, at, flip }, target, HAMSTER_SCURRY);
      ({ at, flip } = trip);
      card = target.card;
      return [rest, ...trip.moves];
    }),
  };
}

// ---- 蝶々: ひらひら飛んで、語が入ったカードに停まる ----

function butterflyPlanner({ cards, rand }: PlanContext): Planner {
  const first = cardsBounds(cards());
  let at = { x: within(rand, first.left, first.right), y: first.top - 12 };
  /** カードの右上あたり（語の真ん中は隠さない） */
  const landingOn = (card: CritterCard) => ({ x: card.x + card.w * within(rand, 0.72, 0.9), y: card.y + 12 });
  const flyTo = (to: Pt): CritterMove => {
    const move = { from: at, to, ms: Math.max(700, (distance(at, to) / 42) * 1000), gait: "fly", ease: true };
    at = to;
    return move;
  };
  return {
    next: queue(() => {
      const list = cards();
      const filled = list.filter((card) => !card.empty);
      if (filled.length > 0 && rand() < 0.35) {
        const fresh = filled.filter((card) => !card.center);
        return [flyTo(landingOn(pick(fresh.length > 0 ? fresh : filled, rand))), stay(at, within(rand, 1600, 3200), "rest")];
      }
      const box = cardsBounds(list);
      return [flyTo({ x: within(rand, box.left - 16, box.right + 16), y: within(rand, box.top - 22, box.bottom + 10) })];
    }),
    // 待ちが終わったら、語が入ったばかりのカードに停まってから消える
    finale: () => {
      const list = cards();
      const fresh = list.filter((card) => card.empty);
      const card = fresh.length > 0 ? pick(fresh, rand) : (list.find((item) => item.center) ?? list[0]!);
      const to = landingOn(card);
      return [{ from: at, to, ms: 900, gait: "fly", ease: true }, stay(to, 1100, "rest")];
    },
  };
}

// ---- 小鳥: 中心のカードでさえずり、語が届くと飛び立つ ----

function birdPlanner({ cards, rand }: PlanContext): Planner {
  const home = () => {
    const list = cards();
    return list.find((card) => card.center) ?? list[0]!;
  };
  let t = within(rand, 0.3, 0.7);
  let at = perch(home(), t);
  let flip = rand() < 0.5;
  return {
    next: queue(() => {
      const card = home();
      at = perch(card, t);
      const roll = rand();
      if (roll < 0.4) {
        const dir = flip ? -1 : 1;
        const notes = [0, 550].map((delay, index) => ({ kind: "note" as const, dx: dir * (10 + index * 6), dy: -24, delay }));
        return [stay(at, 1300, "chirp", { flip, emit: notes }), stay(at, within(rand, 500, 1100), "sit", { flip })];
      }
      if (roll < 0.72) {
        t = Math.min(0.88, Math.max(0.12, t + (rand() < 0.5 ? -1 : 1) * within(rand, 0.1, 0.24)));
        const to = perch(card, t);
        flip = to.x < at.x;
        const hop: CritterMove = { from: at, to, ms: 280, gait: "sit", hop: 7, flip };
        at = to;
        return [hop, stay(to, within(rand, 400, 900), "sit", { flip })];
      }
      flip = !flip;
      return [stay(at, within(rand, 700, 1400), "sit", { flip })];
    }),
    finale: () => {
      const dir = flip ? -1 : 1;
      return [{ from: at, to: { x: at.x + dir * 120, y: at.y - 170 }, ms: 1300, gait: "fly", flip }];
    },
  };
}

// ---- ねこ: カードの上で丸くなって寝る ----

function catPlanner({ cards, rand }: PlanContext): Planner {
  const start = cards();
  let card = Math.floor(rand() * start.length);
  let at = perch(start[card]!, within(rand, 0.25, 0.75));
  let flip = rand() < 0.5;
  return {
    next: queue(() => {
      const list = cards();
      const sleep = within(rand, 5500, 9000);
      const dir = flip ? -1 : 1;
      const zzz = Array.from({ length: Math.floor(sleep / 1500) }, (_, index) => ({
        kind: "z" as const,
        dx: dir * 14,
        dy: -20,
        delay: 600 + index * 1500,
      }));
      const moves = [
        stay(at, within(rand, 900, 1500), "sit", { flip }),
        stay(at, sleep, "sleep", { flip, emit: zzz }),
        stay(at, 900, "sit", { flip }),
      ];
      // 起きたら、同じカードの縁を歩くか、近くのカードへ跳ぶ
      if (rand() < 0.5) {
        const to = perch(list[card]!, within(rand, 0.15, 0.85));
        flip = to.x < at.x;
        moves.push({ from: at, to, ms: Math.max(400, (distance(at, to) / 30) * 1000), gait: "walk", flip });
        at = to;
      } else {
        card = nearbyCard(list, at, card, rand);
        const to = perch(list[card]!, within(rand, 0.25, 0.75));
        flip = to.x < at.x;
        const far = distance(at, to);
        moves.push({ from: at, to, ms: Math.min(1000, 420 + far * 0.8), gait: "jump", hop: 28 + far * 0.15, flip });
        at = to;
      }
      return moves;
    }),
  };
}

// ---- 動物ごとの動き ----

export function cutePlanner(kind: string, context: PlanContext): Planner {
  const { rand } = context;
  switch (kind) {
    case "frog":
      return frogPlanner(context);
    case "rabbit":
      return rabbitPlanner(context);
    case "squirrel":
      return squirrelPlanner(context);
    case "hamster":
      return hamsterPlanner(context);
    case "butterfly":
      return butterflyPlanner(context);
    case "bird":
      return birdPlanner(context);
    case "cat":
      return catPlanner(context);
    case "chicks":
      return gridPlanner(context, {
        speed: 34,
        gait: "walk",
        pause: 0.3,
        rest: (at, _, last) => [stay(at, within(rand, 1200, 2200), "peck", { flip: last.flip })],
      });
    case "dog":
      return gridPlanner(context, {
        speed: 72,
        gait: "run",
        pause: 0.3,
        rest: (at, _, last) =>
          rand() < 0.65
            ? [
                stay(at, within(rand, 1300, 2300), "sit", {
                  flip: last.flip,
                  emit: rand() < 0.6 ? [{ kind: "heart", dx: last.flip ? -10 : 10, dy: -30, delay: 300 }] : undefined,
                }),
              ]
            : [stay(at, 1200, "spin")],
      });
    case "goldfish":
      return gridPlanner(context, {
        speed: 36,
        gait: "swim",
        pause: 0.22,
        step: (_, heading) => ({ turn: TURN[heading], flip: false }),
        rest: (at) => [
          stay(at, within(rand, 900, 1700), "hover", {
            emit: [
              { kind: "bubble", dy: -8, delay: 150 },
              { kind: "bubble", dx: 5, dy: -12, delay: 650 },
            ],
          }),
        ],
      });
    case "dolphin":
      return gridPlanner(context, {
        speed: 42,
        gait: "fin",
        pause: 0,
        // 横の水路では、ときどき水から跳ねて次の角へ（弧に沿って傾き、両端で水しぶき）
        step: (move, heading) => {
          if ((heading !== "left" && heading !== "right") || rand() < 0.55) return {};
          const ms = within(rand, 800, 1000);
          return {
            gait: "leap",
            ms,
            hop: within(rand, 34, 50),
            arcTilt: true,
            emit: [{ kind: "splash" }, { kind: "splash", at: move.to, delay: ms - 40 }],
          };
        },
      });
    case "horse":
      return gridPlanner(context, {
        speed: 95,
        gait: "run",
        pause: 0.15,
        ring: true,
        rest: (at, _, last) => [stay(at, within(rand, 900, 1700), "stand", { flip: last.flip })],
      });
    case "foxtanuki":
      return gridPlanner(context, {
        speed: 44,
        gait: "walk",
        pause: 0.35,
        // 立ち止まると、きつねは座り、たぬきは腹つづみ（ぽんぽこ）
        rest: (at, _, last) => [
          stay(at, within(rand, 1800, 2800), "rest", {
            flip: last.flip,
            emit: [0, 450, 900, 1350].map((delay) => ({ kind: "note" as const, actor: 1, dy: -30, delay })),
          }),
        ],
      });
    default:
      return gridPlanner(context, {
        speed: 52,
        gait: "walkSide",
        pause: 0.25,
        // ペンギン: 横は横向き（たまにお腹で滑る）、下へは正面、上へは後ろ姿
        step: (move, heading) => {
          const pose = POSE[heading];
          if (pose === "Side" && rand() < 0.3) return { gait: "slide", ms: move.ms / 2.2 };
          return { gait: `walk${pose}` };
        },
        rest: (at, _, last) => [stay(at, within(rand, 700, 1600), `idle${POSE[last.heading]}`, { flip: last.flip })],
      });
  }
}
