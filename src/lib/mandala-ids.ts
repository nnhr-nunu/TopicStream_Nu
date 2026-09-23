import type { TNode } from "@/lib/types";

/** 読み順（左→右、上→下）。中央は E（index 4）。 */
export const CARD_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"] as const;
export const CENTER_CELL_INDEX = 4;
export const FAMILY_COUNT = 8;

export const MANDALA_CELL_OFFSETS: { x: number; y: number }[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

export const KEYWORD_CELL_INDICES = [0, 1, 2, 3, 5, 6, 7, 8] as const;

export function cellCode(groupId: number, cellIndex: number): string {
  const letter = CARD_LETTERS[cellIndex];
  if (!letter || !Number.isFinite(groupId) || groupId < 1) return "";
  return `${groupId}${letter}`;
}

export function familyIndexForGroup(groupId: number): number {
  return ((groupId - 1) % FAMILY_COUNT + FAMILY_COUNT) % FAMILY_COUNT;
}

export function isCenterCell(cellIndex: number | undefined): boolean {
  return cellIndex === CENTER_CELL_INDEX;
}

export function nextGroupId(nodes: Pick<TNode, "data">[]): number {
  const used = new Set<number>();
  for (const node of nodes) {
    const id = node.data.groupId;
    if (typeof id === "number" && id > 0) used.add(id);
  }
  let next = 1;
  while (used.has(next)) next += 1;
  return next;
}

export function usedCellIndices(nodes: Pick<TNode, "data">[], groupId: number): Set<number> {
  const used = new Set<number>();
  for (const node of nodes) {
    if (node.data.groupId !== groupId) continue;
    if (typeof node.data.cellIndex === "number") used.add(node.data.cellIndex);
  }
  return used;
}
