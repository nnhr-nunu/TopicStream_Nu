/**
 * ほかの画面（トップの話題・トピック図鑑・みんなのトークテーマ）で、カードの一覧の上に時々遊びに来る動物。
 * AI の待ち（wait-critters.ts）が早く終わって見られない動きを、ここでゆっくり見せる。
 * ここは出す動物・遊ぶ範囲・間合いを決める計算だけ。画面は ambient-critters.tsx
 */

import { CRITTER_KINDS, type CritterCard, type CritterKind } from "@/lib/wait-critters";

/** 金魚・イルカは溝を水路にするので、字の詰まったカードの一覧には出さない */
const WATER_KINDS: readonly CritterKind[] = ["goldfish", "dolphin"];

/** 最初に出るまで・いる長さ・次に出るまで（ms） */
export const AMBIENT_TIMING = {
  first: [0, 300],
  stay: [22_000, 35_000],
  gap: [2000, 5000],
} as const;

/** 一覧の data-critter-skip（空白区切り）から、その一覧に出さない動物 */
export const skippedKinds = (value: string | undefined): string[] => value?.split(/\s+/).filter(Boolean) ?? [];

export const between =(rand: () => number, [min, max]: readonly [number, number]) => min + rand() * (max - min);

/**
 * 出す動物（設定でしまったもの・水の動物は出さない。できれば前回と違うもの）。出せるものが無ければ null。
 * hidden には、その一覧で出さない子（data-critter-skip）・ほかの一覧に来ている子も足して渡す
 */
export function pickAmbientKind(hidden: readonly string[], rand: () => number, last?: CritterKind | null): CritterKind | null {
  const kinds = CRITTER_KINDS.filter((kind) => !hidden.includes(kind) && !WATER_KINDS.includes(kind));
  if (kinds.length === 0) return null;
  const fresh = kinds.filter((kind) => kind !== last);
  const from = fresh.length > 0 ? fresh : kinds;
  return from[Math.floor(rand() * from.length) % from.length]!;
}

/**
 * 見えているカードから、遊ぶ範囲を選ぶ: 上の縁が画面に入っている行を1つ選び、下の行も見えていればときどき足す（行はそのまま全部の列）。
 * rects は一覧の左上からの位置、view は一覧の座標で見えている上下。2枚に満たなければ null
 */
export function ambientCards(
  rects: CritterCard[],
  view: { top: number; bottom: number },
  rand: () => number,
): CritterCard[] | null {
  const rows: CritterCard[][] = [];
  for (const card of [...rects].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const last = rows.at(-1);
    if (last && Math.abs(last[0]!.y - card.y) <= 4) last.push(card);
    else rows.push([card]);
  }
  // 動物は上の縁に乗るので、縁の上に少し余白があり、カードの頭が見えている行
  const seen = (row: CritterCard[]) => row[0]!.y >= view.top + 36 && row[0]!.y + 60 <= view.bottom;
  const visible = rows.map((row, index) => ({ row, index })).filter(({ row }) => seen(row));
  if (visible.length === 0) return null;
  const start = visible[Math.floor(rand() * visible.length) % visible.length]!;
  const below = rows[start.index + 1];
  const cards = [...start.row, ...(below && seen(below) && (start.row.length < 2 || rand() < 0.6) ? below : [])];
  return cards.length >= 2 ? cards : null;
}
