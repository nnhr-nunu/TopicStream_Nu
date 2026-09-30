import { getBoardSnapshot, requestOpenActiveBoard, writeBoardSnapshot } from "@/lib/board-store";
import { boardFromTopics } from "@/lib/catalog-data";
import { layoutBoard, prefsFromSettings } from "@/lib/layout";
import { withMode } from "@/lib/modes";
import type { BoardMode } from "@/lib/types";

/**
 * 図鑑のお題とその語から、AI を呼ばずに新しいボードを作って「今のボード」にする（図鑑・お題ごとのページから始めるとき）。
 * 呼んだ側は、このあとページを読み直さずに "/" へ移る（マップを直接開く印はメモリにあるため）
 */
export function openBoardFromTopics(seed: string, topics: string[], mode: BoardMode) {
  const snapshot = getBoardSnapshot();
  const built = withMode(boardFromTopics(seed, topics), mode);
  const board = layoutBoard(built, prefsFromSettings(snapshot.settings, false, built.pinnedNodeId));
  writeBoardSnapshot({ ...snapshot, boards: [...snapshot.boards, board], activeBoardId: board.id });
  requestOpenActiveBoard();
}
