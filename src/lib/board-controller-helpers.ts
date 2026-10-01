// useBoardController と、そこから分けたフックで共有する小さな関数

import { getBoardSnapshot } from "@/lib/board-store";
import { updateHistory } from "@/lib/board-history";
import type { AppSnapshot, Board, HistoryEntry } from "@/lib/types";

export function currentSnapshot(): AppSnapshot {
  return getBoardSnapshot();
}

/** 広げ中の結果を捨てるための世代の鍵。同じカードの ID が別のボードにもあるので、ボードごとに分ける */
export const expandKey = (boardId: string, nodeId: string) => `${boardId}:${nodeId}`;

export function sameEntry(entry: HistoryEntry, parentId: string, childIds: string[]) {
  return (
    entry.parentId === parentId &&
    entry.childIds.length === childIds.length &&
    entry.childIds.every((id, index) => id === childIds[index])
  );
}

/**
 * AI に「重ならないように」と渡す盤面の語。空のカード（…）は外し、広げるカードのまわり（同じ 3×3・たどってきたカード）を先に置く
 * （AI へ渡すのは先頭の数十語だけなので、古い 3×3 の語より、並ぶと目立つ近くの語を優先する）
 */
export function existingForPrompt(board: Board, nodeId: string): string[] {
  const byId = new Map(board.nodes.map((node) => [node.id, node]));
  const near: string[] = [];
  const parentId = byId.get(nodeId)?.data.parentId ?? null;
  for (const node of board.nodes) {
    if (node.data.parentId === nodeId || (parentId !== null && node.data.parentId === parentId)) near.push(node.data.label);
  }
  for (let id: string | null = nodeId, guard = 0; id && guard < 64; guard += 1) {
    const node = byId.get(id);
    if (!node) break;
    near.push(node.data.label);
    id = node.data.parentId;
  }
  const rest = [...board.nodes].reverse().map((node) => node.data.label);
  const placeholders = new Set(board.nodes.filter((node) => node.data.placeholder).map((node) => node.data.label));
  return [...new Set([...near, ...rest])].filter((label) => label.trim() && !placeholders.has(label));
}

/** 新しい操作をしたら、進む履歴は捨てる */
export function pushUndo(boardId: string, entry: HistoryEntry) {
  updateHistory(boardId, (history) => ({ undo: [...history.undo, entry], redo: [] }));
}
