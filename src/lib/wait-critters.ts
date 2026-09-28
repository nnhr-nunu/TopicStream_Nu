/**
 * AI を待っている間に、3×3（中心＋周りのカード）を1枚の庭に見立てて歩き回る小さな動物（ピクセルアート）。
 * ここは絵のドット・カードの位置から道を作る計算・次の動きを決める計算だけ（画面は wait-critters.tsx）。
 */

export type Pt = { x: number; y: number };
/** カードの枠（左上と大きさ）。cell は 3×3 のマス番号（0〜8、4 が中心）。放射の並べ方では無い */
export type CritterCard = { x: number; y: number; w: number; h: number; cell?: number };

export type CritterKind = "frog" | "penguin";
export const CRITTER_KINDS: CritterKind[] = ["frog", "penguin"];

/** 絵の1ドットの大きさ（盤面の座標で） */
export const CRITTER_PX = 2.25;

// ---- 絵（1文字 = 1ドット。"." は透明） ----

export type Sprite = { palette: Record<string, string>; frames: Record<string, string[]> };

const FROG_PALETTE = {
  D: "#2f5b33",
  G: "#72c450",
  L: "#dcf3a8",
  W: "#ffffff",
  K: "#1c1c1c",
  p: "#f59caa",
};

const FROG_FACE = [
  "..DDD....DDD..",
  ".DWWWD..DWWWD.",
  ".DWKWDDDDWKWD.",
  "DGGGGGGGGGGGGD",
  "DGppGGGGGGppGD",
  "DGGGGDGGDGGGGD",
  ".DGGGGDDGGGGD.",
];

const FROG_BLINK_FACE = [
  "..DDD....DDD..",
  ".DGGGD..DGGGD.",
  ".DKKKDDDDKKKD.",
  ...FROG_FACE.slice(3),
];

const FROG_SIT_BODY = [
  ".DGGLLLLLLGGD.",
  "DGGDLLLLLLDGGD",
  "DGGDDLLLLDDGGD",
  ".DDD.DDDD.DDD.",
];

const FROG_JUMP_BODY = [
  "..DGLLLLLLGD..",
  "..DGLLLLLLGD..",
  "..DDLLLLLLDD..",
  ".DGD.DDDD.DGD.",
  "DGD........DGD",
  "DD..........DD",
];

const EMPTY14 = "..............";

/** カエル（正面）。座っているときは2行下げて、跳んだとき脚が伸びる */
export const FROG: Sprite = {
  palette: FROG_PALETTE,
  frames: {
    sit: [EMPTY14, EMPTY14, ...FROG_FACE, ...FROG_SIT_BODY],
    blink: [EMPTY14, EMPTY14, ...FROG_BLINK_FACE, ...FROG_SIT_BODY],
    jump: [...FROG_FACE, ...FROG_JUMP_BODY],
  },
};

const PENGUIN_PALETTE = {
  K: "#26344a",
  k: "#3d5170",
  W: "#fbfbf6",
  E: "#141414",
  O: "#f4a236",
  p: "#f7a3b2",
};

const PENGUIN_SIDE = [
  "....KKKK....",
  "...KKKKKK...",
  "..KKKKKKKK..",
  "..KKKKKWEK..",
  "..KKKKKKKOOO",
  "..KKKKKWpWK.",
  ".KKKKKWWWWWK",
  ".KKkKKWWWWWK",
  "KKkkKKWWWWWK",
  "KKkkKKWWWWWK",
  ".KkKKKWWWWK.",
  "..KKKKWWWK..",
  "...KKKKKK...",
];

const PENGUIN_FRONT = [
  "....KKKK....",
  "...KKKKKK...",
  "..KKKKKKKK..",
  "..KWEWWEWK..",
  "..KWWOOWWK..",
  ".KKpWWWWpKK.",
  ".KKWWWWWWKK.",
  "KkKWWWWWWKkK",
  "KkKWWWWWWKkK",
  "KkKWWWWWWKkK",
  ".KKWWWWWWKK.",
  "..KKWWWWKK..",
  "...KKKKKK...",
];

const PENGUIN_BACK = [
  "....KKKK....",
  "...KkkKKK...",
  "..KKkKKKKK..",
  "..KKKKKKKK..",
  "..KKKKKKKK..",
  ".KKKKKKKKKK.",
  ".KKKKKKKKKK.",
  "KkKKKKKKKKkK",
  "KkKKKKKKKKkK",
  "KkKKKKKKKKkK",
  ".KKKKKKKKKK.",
  "..KKKKKKKK..",
  "...KKKKKK...",
];

/** ペンギン。横向き（右向き。左へは反転）・正面（下へ）・後ろ姿（上へ）を、足の2コマで歩かせる */
export const PENGUIN: Sprite = {
  palette: PENGUIN_PALETTE,
  frames: {
    side0: [...PENGUIN_SIDE, "....OOOO...."],
    side1: [...PENGUIN_SIDE, "..OO....OO.."],
    front0: [...PENGUIN_FRONT, "..OOO...OO.."],
    front1: [...PENGUIN_FRONT, "..OO...OOO.."],
    back0: [...PENGUIN_BACK, "..OOO...OO.."],
    back1: [...PENGUIN_BACK, "..OO...OOO.."],
  },
};

export const SPRITES: Record<CritterKind, Sprite> = { frog: FROG, penguin: PENGUIN };

export type PixelRun = { x: number; y: number; w: number; fill: string };

/** 絵を横に続く同じ色ごとにまとめた長方形にする（SVG の rect を減らす） */
export function spriteRuns(rows: string[], palette: Record<string, string>): PixelRun[] {
  const runs: PixelRun[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const char = row[x]!;
      let end = x + 1;
      while (end < row.length && row[end] === char) end += 1;
      const fill = palette[char];
      if (char !== "." && fill) runs.push({ x, y, w: end - x, fill });
      x = end;
    }
  });
  return runs;
}

export function spriteSize(sprite: Sprite): { w: number; h: number } {
  const first = Object.values(sprite.frames)[0]!;
  return { w: first[0]!.length, h: first.length };
}

/** 待っている盤面ごとに、どの動物が出るか（カードの id から決めるので、同じ待ちの間は変わらない） */
export function critterFor(key: string): CritterKind {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return CRITTER_KINDS[hash % CRITTER_KINDS.length]!;
}

// ---- どこで待っているか ----

/** 盤面のカード（React Flow のノード。位置はカードの中心、大きさは測れたあと入る） */
export type CritterNode = {
  id: string;
  position: Pt;
  measured?: { width?: number; height?: number };
  data: { parentId: string | null; placeholder?: boolean; cellIndex?: number; groupId?: number };
};

export type CritterGroup = { key: string; cards: CritterCard[] };

/** 親のカードと、その子のカードたち（マンダラートなら中心＋周りの8枚）。大きさが測れていなければ null */
function groupAround(nodes: CritterNode[], parentId: string): CritterGroup | null {
  const cards: CritterCard[] = [];
  for (const node of nodes) {
    if (node.id !== parentId && node.data.parentId !== parentId) continue;
    const w = node.measured?.width;
    const h = node.measured?.height;
    if (!w || !h) return null;
    cards.push({ x: node.position.x - w / 2, y: node.position.y - h / 2, w, h, cell: node.data.cellIndex });
  }
  return cards.length > 1 ? { key: parentId, cards } : null;
}

/** 空のカード（AI の語を待っている）がある盤面ごとの、動物が遊ぶ範囲 */
export function waitingGroups(nodes: CritterNode[]): CritterGroup[] {
  const parents = new Set<string>();
  for (const node of nodes) if (node.data.placeholder && node.data.parentId) parents.add(node.data.parentId);
  return [...parents].map((id) => groupAround(nodes, id)).filter((group): group is CritterGroup => group !== null);
}

/** 試しに出すとき（?critter=frog など）の範囲: 選んでいるカードの 3×3（無ければ最初のカードの周り） */
export function previewGroup(nodes: CritterNode[], focusedId: string | null, centerCell: number): CritterGroup | null {
  const focused = nodes.find((node) => node.id === focusedId) ?? nodes[0];
  if (!focused) return null;
  if (typeof focused.data.groupId === "number") {
    const center = nodes.find((node) => node.data.groupId === focused.data.groupId && node.data.cellIndex === centerCell);
    return groupAround(nodes, center?.id ?? focused.id);
  }
  const hasChildren = nodes.some((node) => node.data.parentId === focused.id);
  return groupAround(nodes, hasChildren ? focused.id : (focused.data.parentId ?? focused.id));
}

// ---- 盤面から、歩ける道を作る ----

/** 外周の道を、カードの端からどれだけ離すか */
const OUTER_MARGIN = 18;

/**
 * カードの間の道（格子）。3×3 がそろっていればカードの間の溝と外周、そうでなければ外周だけ。
 * xs / ys の交わる点が曲がり角になる
 */
export function critterPaths(cards: CritterCard[]): { xs: number[]; ys: number[] } {
  const left = Math.min(...cards.map((card) => card.x));
  const top = Math.min(...cards.map((card) => card.y));
  const right = Math.max(...cards.map((card) => card.x + card.w));
  const bottom = Math.max(...cards.map((card) => card.y + card.h));
  const outerX = [left - OUTER_MARGIN, right + OUTER_MARGIN];
  const outerY = [top - OUTER_MARGIN, bottom + OUTER_MARGIN];
  const byCell = new Map(cards.filter((card) => typeof card.cell === "number").map((card) => [card.cell!, card]));
  if (byCell.size !== 9) return { xs: outerX, ys: outerY };

  const cellsIn = (pick: (cell: number) => boolean) => [...byCell.entries()].filter(([cell]) => pick(cell)).map(([, card]) => card);
  const between = (a: CritterCard[], b: CritterCard[], axis: "x" | "y") => {
    const end = Math.max(...a.map((card) => (axis === "x" ? card.x + card.w : card.y + card.h)));
    const start = Math.min(...b.map((card) => (axis === "x" ? card.x : card.y)));
    return (end + start) / 2;
  };
  const column = (index: number) => cellsIn((cell) => cell % 3 === index);
  const row = (index: number) => cellsIn((cell) => Math.floor(cell / 3) === index);
  return {
    xs: [outerX[0]!, between(column(0), column(1), "x"), between(column(1), column(2), "x"), outerX[1]!],
    ys: [outerY[0]!, between(row(0), row(1), "y"), between(row(1), row(2), "y"), outerY[1]!],
  };
}

// ---- 動き ----

/** 1回分の動き。from → to を ms かけて進む。hop は弧の高さ（跳ぶとき） */
export type CritterMove = {
  from: Pt;
  to: Pt;
  ms: number;
  pose: string;
  /** 歩きのように2コマを交互に出す（pose + "0" / "1"）。無ければ pose そのもの（無い絵なら pose + "0"） */
  steps?: boolean;
  hop?: number;
  /** 左右反転（右向きの絵を左向きに）。無ければ前の向きのまま */
  flip?: boolean;
};

export type Rand = () => number;

const pick = <T>(items: T[], rand: Rand): T => items[Math.floor(rand() * items.length) % items.length]!;
const distance = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** カエルが座る場所（カードの上の縁に、足を少しかける） */
export function frogPerch(card: CritterCard, rand: Rand): Pt {
  return { x: card.x + card.w * (0.22 + rand() * 0.56), y: card.y + 2 };
}

export type FrogState = { card: number; at: Pt; resting: boolean };

/**
 * カエル: カードからカードへ跳ぶ。着いたら少し休む（まばたきは画面側でときどき入れる）。
 * 行き先はたいてい近くのカード、たまに遠くへ大ジャンプ
 */
export function nextFrogMove(state: FrogState, cards: CritterCard[], rand: Rand): { move: CritterMove; state: FrogState } {
  if (!state.resting) {
    const ms = 900 + rand() * 1300;
    return { move: { from: state.at, to: state.at, ms, pose: "sit" }, state: { ...state, resting: true } };
  }
  const others = cards.map((card, index) => ({ card, index })).filter(({ index }) => index !== state.card);
  if (others.length === 0) return { move: { from: state.at, to: state.at, ms: 1200, pose: "sit" }, state };
  const near = [...others].sort(
    (a, b) => distance(state.at, frogPerch(a.card, () => 0.5)) - distance(state.at, frogPerch(b.card, () => 0.5)),
  );
  const target = rand() < 0.2 ? pick(others, rand) : pick(near.slice(0, 3), rand);
  const to = frogPerch(target.card, rand);
  const far = distance(state.at, to);
  return {
    move: { from: state.at, to, ms: Math.min(1100, 420 + far * 0.9), pose: "jump", hop: 34 + far * 0.2 },
    state: { card: target.index, at: to, resting: false },
  };
}

export type PenguinState = { i: number; j: number; from?: { i: number; j: number } };

/** ペンギンが歩く速さ（盤面の座標で 1 秒あたり） */
const PENGUIN_SPEED = 52;

/**
 * ペンギン: カードの間の道を、曲がり角ごとに向きを選んでよちよち歩く（来た道はなるべく戻らない）。
 * 角でときどき立ち止まる
 */
export function nextPenguinMove(
  state: PenguinState,
  paths: { xs: number[]; ys: number[] },
  rand: Rand,
  lastPose = "front",
): { move: CritterMove; state: PenguinState } {
  const at = { x: paths.xs[state.i]!, y: paths.ys[state.j]! };
  if (state.from && rand() < 0.25) {
    return {
      move: { from: at, to: at, ms: 700 + rand() * 900, pose: lastPose },
      state: { i: state.i, j: state.j },
    };
  }
  const options = [
    { i: state.i + 1, j: state.j },
    { i: state.i - 1, j: state.j },
    { i: state.i, j: state.j + 1 },
    { i: state.i, j: state.j - 1 },
  ].filter((next) => next.i >= 0 && next.j >= 0 && next.i < paths.xs.length && next.j < paths.ys.length);
  const forward = options.filter((next) => !(state.from && next.i === state.from.i && next.j === state.from.j));
  const next = pick(forward.length > 0 ? forward : options, rand);
  const to = { x: paths.xs[next.i]!, y: paths.ys[next.j]! };
  const dx = to.x - at.x;
  const dy = to.y - at.y;
  const pose = Math.abs(dx) >= Math.abs(dy) ? "side" : dy > 0 ? "front" : "back";
  return {
    move: {
      from: at,
      to,
      ms: Math.max(400, (distance(at, to) / PENGUIN_SPEED) * 1000),
      pose,
      steps: true,
      flip: pose === "side" && dx < 0,
    },
    state: { i: next.i, j: next.j, from: { i: state.i, j: state.j } },
  };
}
