/**
 * AI を待っている間に、3×3（中心＋周りのカード）を1枚の庭に見立てて遊ぶ小さな動物（ピクセルアート）。
 * ここは種類と選び方・待っている盤面の取り出し・待ちの出入り・カードの位置から道を作る計算だけ。
 * 動きは critter-moves.ts、どの絵をどう動かすかは critter-cast.ts、画面は wait-critters.tsx
 */

export type Pt = { x: number; y: number };

/**
 * カードの枠（左上と大きさ）。cell は 3×3 のマス番号（0〜8、4 が中心。放射の並べ方では無い）。
 * empty は語を待っている空のカード、center は広げたもとのカード
 */
export type CritterCard = { x: number; y: number; w: number; h: number; cell?: number; empty?: boolean; center?: boolean };

export const CRITTER_KINDS = [
  "frog",
  "penguin",
  "rabbit",
  "butterfly",
  "chicks",
  "bird",
  "squirrel",
  "goldfish",
  "cat",
  "dog",
  "hamster",
  "horse",
  "dolphin",
  "foxtanuki",
] as const;

export type CritterKind = (typeof CRITTER_KINDS)[number];

export const CRITTER_LABELS: Record<CritterKind, string> = {
  frog: "カエル",
  penguin: "ペンギン",
  rabbit: "うさぎ",
  butterfly: "ちょうちょ",
  chicks: "ひよこ",
  bird: "小鳥",
  squirrel: "リス",
  goldfish: "金魚",
  cat: "ねこ",
  dog: "いぬ",
  hamster: "ハムスター",
  horse: "うま",
  dolphin: "イルカ",
  foxtanuki: "きつねとたぬき",
};

/** 絵のタッチ。cute はカードの上や間を歩く、real はカードの中（空のカードを窓に見立てて）を歩く */
export type CritterStyle = "cute" | "real";
/** 設定の「絵のタッチ」。mix は待ちごとにどちらか */
export type CritterStylePref = "mix" | CritterStyle;

export const CRITTER_STYLE_PREFS: CritterStylePref[] = ["mix", "cute", "real"];

export function isCritterKind(value: unknown): value is CritterKind {
  return typeof value === "string" && (CRITTER_KINDS as readonly string[]).includes(value);
}

function hashKey(key: string): number {
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
}

/**
 * この待ちに出す動物とタッチ。seed（盤面のカードの id）から決めるので、同じ待ちの間は変わらず、広げ直すと変わる。
 * 全部しまってあれば null
 */
export function pickCritter(
  seed: string,
  hidden: readonly string[],
  stylePref: CritterStylePref,
): { kind: CritterKind; style: CritterStyle } | null {
  const kinds = CRITTER_KINDS.filter((kind) => !hidden.includes(kind));
  if (kinds.length === 0) return null;
  const hash = hashKey(seed);
  const kind = kinds[hash % kinds.length]!;
  const style: CritterStyle = stylePref === "mix" ? ((hash >>> 12) % 2 === 0 ? "cute" : "real") : stylePref;
  return { kind, style };
}

// ---- どこで待っているか ----

/** 盤面のカード（React Flow のノード。位置はカードの中心、大きさは測れたあと入る） */
export type CritterNode = {
  id: string;
  position: Pt;
  measured?: { width?: number; height?: number };
  data: { parentId: string | null; placeholder?: boolean; cellIndex?: number; groupId?: number };
};

/** key は広げたもとのカードの id、seed は動物を選ぶ種（範囲のカードの id） */
export type CritterGroup = { key: string; seed: string; cards: CritterCard[] };

/** 親のカードと、その子のカードたち（マンダラートなら中心＋周りの8枚）。大きさが測れていなければ null */
function groupAround(nodes: CritterNode[], parentId: string): CritterGroup | null {
  const cards: CritterCard[] = [];
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.id !== parentId && node.data.parentId !== parentId) continue;
    const w = node.measured?.width;
    const h = node.measured?.height;
    if (!w || !h) return null;
    ids.push(node.id);
    cards.push({
      x: node.position.x - w / 2,
      y: node.position.y - h / 2,
      w,
      h,
      cell: node.data.cellIndex,
      ...(node.data.placeholder ? { empty: true } : {}),
      ...(node.id === parentId ? { center: true } : {}),
    });
  }
  return cards.length > 1 ? { key: parentId, seed: ids.sort().join(","), cards } : null;
}

/** 空のカード（AI の語を待っている）を持つ親のカードの id */
function waitingParentIds(nodes: CritterNode[]): Set<string> {
  const parents = new Set<string>();
  for (const node of nodes) if (node.data.placeholder && node.data.parentId) parents.add(node.data.parentId);
  return parents;
}

/** 空のカード（AI の語を待っている）がある盤面ごとの、動物が遊ぶ範囲（大きさがまだ測れていない盤面は入らない） */
export function waitingGroups(nodes: CritterNode[]): CritterGroup[] {
  return [...waitingParentIds(nodes)].map((id) => groupAround(nodes, id)).filter((group): group is CritterGroup => group !== null);
}

/**
 * 試しに出すとき（?critter=frog など）の範囲: 選んでいるカードの 3×3（無ければ最初のカードの周り）。
 * 語の入ったカードばかりなので、中心以外を空のカードとして扱う（リアルな絵がカードの中を歩けるように）
 */
export function previewGroup(nodes: CritterNode[], focusedId: string | null, centerCell: number): CritterGroup | null {
  const focused = nodes.find((node) => node.id === focusedId) ?? nodes[0];
  if (!focused) return null;
  let group: CritterGroup | null;
  if (typeof focused.data.groupId === "number") {
    const center = nodes.find((node) => node.data.groupId === focused.data.groupId && node.data.cellIndex === centerCell);
    group = groupAround(nodes, center?.id ?? focused.id);
  } else {
    const hasChildren = nodes.some((node) => node.data.parentId === focused.id);
    group = groupAround(nodes, hasChildren ? focused.id : (focused.data.parentId ?? focused.id));
  }
  return group && { ...group, cards: group.cards.map((card) => (card.center ? card : { ...card, empty: true })) };
}

// ---- 待ちの出入り ----

/** 動物が遊ぶ範囲（待ち）。waitNo は待ちごとの通し番号（同じカードを広げ直したら別の待ち = 新しい場面にする） */
export type CritterWait = CritterGroup & { waitNo: number };

/**
 * 待ちの出入りの記録。live は待っている範囲、leaving は待ちが終わって消える途中の範囲。
 * 同じカードの範囲は live か leaving のどちらかに1つだけ。lastNo は最後に付けた待ち番号
 */
export type WaitTrack = { live: CritterWait[]; leaving: CritterWait[]; lastNo: number };

export const NO_WAITS: WaitTrack = { live: [], leaving: [], lastNo: 0 };

/**
 * 盤面が変わったときの、待ちの出入り。待ちが終わるのは、親のカードの空のカードが無くなったとき。
 * 語が1つ入るたびに nodes が作り直され、大きさが一瞬測れなくなる間も、まだ待っているので前の範囲のまま続ける
 * （終わったことにすると、同じ場面が消える途中のものとして何枚も重なり、動物が点滅する）
 */
export function trackWaits(prev: WaitTrack, nodes: CritterNode[]): WaitTrack {
  const waiting = waitingParentIds(nodes);
  const measured = new Map(waitingGroups(nodes).map((group) => [group.key, group]));
  const live: CritterWait[] = [];
  const ended: CritterWait[] = [];
  for (const wait of prev.live) {
    if (waiting.has(wait.key)) live.push({ ...(measured.get(wait.key) ?? wait), waitNo: wait.waitNo });
    else ended.push(wait);
    measured.delete(wait.key);
  }
  let lastNo = prev.lastNo;
  for (const group of measured.values()) live.push({ ...group, waitNo: (lastNo += 1) });

  // 広げ直して待ちが戻ったカードの終わりかけの場面は外す。同じ待ちを何度も積まない
  const current = new Set([...live, ...ended].map((wait) => wait.key));
  const kept = prev.leaving.filter((wait) => !current.has(wait.key));
  const leaving = ended.length === 0 && kept.length === prev.leaving.length ? prev.leaving : [...kept, ...ended];
  return { live, leaving, lastNo };
}

/**
 * いま画面に出す待ち。番号順に並べて、終わりかけに変わっても場面の位置を動かさない
 * （生きている順・終わりかけの順に並べると、終わった場面だけ DOM が移って、消える動き（opacity の変化）が飛ぶ）
 */
export function shownWaits(track: WaitTrack): { wait: CritterWait; leaving: boolean }[] {
  return [
    ...track.live.map((wait) => ({ wait, leaving: false })),
    ...track.leaving.map((wait) => ({ wait, leaving: true })),
  ].sort((a, b) => a.wait.waitNo - b.wait.waitNo);
}

// ---- 盤面から、歩ける道を作る ----

/** 外周の道を、カードの端からどれだけ離すか */
const OUTER_MARGIN = 18;

export type CritterPaths = { xs: number[]; ys: number[] };

/** 範囲の外枠 */
export function cardsBounds(cards: CritterCard[]): { left: number; top: number; right: number; bottom: number } {
  return {
    left: Math.min(...cards.map((card) => card.x)),
    top: Math.min(...cards.map((card) => card.y)),
    right: Math.max(...cards.map((card) => card.x + card.w)),
    bottom: Math.max(...cards.map((card) => card.y + card.h)),
  };
}

/**
 * カードの間の道（格子）。3×3 がそろっていればカードの間の溝と外周、そうでなければ外周だけ。
 * xs / ys の交わる点が曲がり角になる
 */
export function critterPaths(cards: CritterCard[]): CritterPaths {
  const { left, top, right, bottom } = cardsBounds(cards);
  const outerX = [left - OUTER_MARGIN, right + OUTER_MARGIN];
  const outerY = [top - OUTER_MARGIN, bottom + OUTER_MARGIN];
  const byCell = new Map(cards.filter((card) => typeof card.cell === "number").map((card) => [card.cell!, card]));
  if (byCell.size !== 9) return alignedPaths(cards) ?? { xs: outerX, ys: outerY };

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

/** 左端（または上端）がそろったカードを、列（行）ごとにまとめる */
function lines(cards: CritterCard[], axis: "x" | "y"): CritterCard[][] {
  const out: CritterCard[][] = [];
  for (const card of [...cards].sort((a, b) => a[axis] - b[axis])) {
    const last = out.at(-1);
    if (last && Math.abs(last[0]![axis] - card[axis]) <= 4) last.push(card);
    else out.push([card]);
  }
  return out;
}

/**
 * 3×3 のマス番号が無いカード（ほかの画面のカードの一覧など）でも、行と列がそろって欠けが無ければ、
 * カードの間の溝と外周を道にする。外周はカードの間の溝の半分だけ離す（隣のカードに乗り上げないように）
 */
function alignedPaths(cards: CritterCard[]): CritterPaths | null {
  const cols = lines(cards, "x");
  const rows = lines(cards, "y");
  if (cards.length < 2 || cols.length * rows.length !== cards.length) return null;
  const between = (groups: CritterCard[][], axis: "x" | "y") =>
    groups.slice(1).map((group, index) => {
      const end = Math.max(...groups[index]!.map((card) => (axis === "x" ? card.x + card.w : card.y + card.h)));
      const start = Math.min(...group.map((card) => card[axis]));
      return { mid: (end + start) / 2, gap: start - end };
    });
  const inX = between(cols, "x");
  const inY = between(rows, "y");
  const gaps = [...inX, ...inY].map((item) => item.gap).filter((gap) => gap > 0);
  const margin = gaps.length > 0 ? Math.min(OUTER_MARGIN, Math.min(...gaps) / 2) : OUTER_MARGIN;
  const { left, top, right, bottom } = cardsBounds(cards);
  return {
    xs: [left - margin, ...inX.map((item) => item.mid), right + margin],
    ys: [top - margin, ...inY.map((item) => item.mid), bottom + margin],
  };
}

/** 水路（溝の道）の太さ。溝の幅（カードの間 32）より少し細く */
export const WATER_WIDTH = 24;

/** 道の格子を、水路の長方形にする（金魚・イルカの溝） */
export function waterChannels(paths: CritterPaths): { x: number; y: number; w: number; h: number }[] {
  const half = WATER_WIDTH / 2;
  const [x0, x1] = [paths.xs[0]!, paths.xs[paths.xs.length - 1]!];
  const [y0, y1] = [paths.ys[0]!, paths.ys[paths.ys.length - 1]!];
  return [
    ...paths.ys.map((y) => ({ x: x0 - half, y: y - half, w: x1 - x0 + WATER_WIDTH, h: WATER_WIDTH })),
    ...paths.xs.map((x) => ({ x: x - half, y: y0 - half, w: WATER_WIDTH, h: y1 - y0 + WATER_WIDTH })),
  ];
}
