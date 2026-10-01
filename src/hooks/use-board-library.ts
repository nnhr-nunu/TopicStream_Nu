"use client";

import { useCallback } from "react";
import { toast } from "sonner";

import * as ops from "@/lib/board-ops";
import { clearHistory } from "@/lib/board-history";
import { currentSnapshot } from "@/lib/board-controller-helpers";
import { catalogBoardToBoard, type CatalogBoard } from "@/lib/catalog-data";
import { layoutBoard, prefsFromSettings } from "@/lib/layout";
import { exportSnapshot, parseImportedBoards } from "@/lib/storage";
import type { AppSnapshot, Board, Settings } from "@/lib/types";

/** ボードの一覧と設定まわり（切り替え・名前・削除・みんなのマップを写す・JSON の書き出しと読み込み） */
export function useBoardLibrary(persist: (next: AppSnapshot) => void) {
  const switchBoard = useCallback(
    (boardId: string) => {
      persist({ ...currentSnapshot(), activeBoardId: boardId });
    },
    [persist],
  );

  const renameBoard = useCallback(
    (name: string, boardId?: string) => {
      const current = currentSnapshot();
      const targetId = boardId ?? current.activeBoardId;
      persist({
        ...current,
        boards: current.boards.map((board) => (board.id === targetId ? ops.renameBoard(board, name) : board)),
      });
    },
    [persist],
  );

  const deleteBoard = useCallback(
    (boardId?: string) => {
      const current = currentSnapshot();
      if (current.boards.length <= 1) {
        toast.error("最後のボードは削除できません");
        return;
      }
      const targetId = boardId ?? current.activeBoardId;
      const remaining = current.boards.filter((board) => board.id !== targetId);
      const activeGone = targetId === current.activeBoardId;
      persist({
        ...current,
        boards: remaining,
        activeBoardId: activeGone ? remaining[0]!.id : current.activeBoardId,
      });
      clearHistory(targetId);
      toast.success("ボードを削除しました");
    },
    [persist],
  );

  const importCatalogBoard = useCallback(
    (catalog: CatalogBoard) => {
      const current = currentSnapshot();
      const board = layoutBoard(
        catalogBoardToBoard(catalog),
        prefsFromSettings(current.settings, false, catalog.nodes[0]?.id ?? null),
      );
      persist({
        ...current,
        boards: [...current.boards, board],
        activeBoardId: board.id,
      });
      toast.success(`「${board.name}」をコピーしました`, { description: "自分のボードとして、続きから広げられます" });
    },
    [persist],
  );

  const patchSettings = useCallback(
    (patch: Partial<Settings>) => {
      const current = currentSnapshot();
      const settings = { ...current.settings, ...patch };
      const relayout =
        patch.generationLayout !== undefined ||
        patch.density !== undefined ||
        patch.fontScale !== undefined;
      const boards = relayout
        ? current.boards.map((board) =>
            layoutBoard(board, prefsFromSettings(settings, false, board.pinnedNodeId)),
          )
        : current.boards;
      persist({ ...current, settings, boards });
    },
    [persist],
  );

  const exportJson = useCallback(() => {
    const blob = new Blob([exportSnapshot(currentSnapshot(), false)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `topicstream-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    // すぐ消すと、ブラウザによっては保存が始まる前に取り消される
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast.success("JSONを書き出しました（APIキーは含みません）");
  }, []);

  /**
   * 書き出した JSON のボードを今のボード一覧に足す（同じボードは読み込んだ内容で置き換える）。
   * 今のボードや設定は消さない。読み込めたら true
   */
  const importJson = useCallback((text: string): boolean => {
    let imported: Board[] | null = null;
    try {
      imported = parseImportedBoards(JSON.parse(text));
    } catch {
      imported = null;
    }
    if (!imported) {
      toast.error("JSONを読み込めませんでした", { description: "TopicStream で書き出したファイルを選んでください。" });
      return false;
    }
    const current = currentSnapshot();
    const byId = new Map(current.boards.map((board) => [board.id, board]));
    const replaced = new Map<string, Board>();
    const added: Board[] = [];
    let kept = 0;
    for (const raw of imported) {
      const board = layoutBoard(raw, prefsFromSettings(current.settings, false, raw.pinnedNodeId));
      const mine = byId.get(board.id);
      if (!mine || mine.updatedAt <= board.updatedAt) {
        if (mine) replaced.set(board.id, board);
        else added.push(board);
        continue;
      }
      // 手元の方が新しい: 古いファイルで上書きして手元の続きを消さないよう、読み込んだ方は別のボードとして足す
      added.push(ops.duplicateBoard(board, `${board.name}（読み込み）`));
      kept += 1;
    }
    const boards = [...current.boards.map((board) => replaced.get(board.id) ?? board), ...added];
    const first = replaced.get(imported[0]!.id) ?? added[0] ?? null;
    persist({ ...current, boards, activeBoardId: first?.id ?? current.activeBoardId });
    for (const board of [...replaced.values(), ...added]) clearHistory(board.id);
    toast.success(`ボードを ${imported.length} 件読み込みました`, {
      description: kept > 0 ? "手元の方が新しいボードは残し、読み込んだ方を「（読み込み）」として足しました" : undefined,
    });
    return true;
  }, [persist]);

  return { switchBoard, renameBoard, deleteBoard, importCatalogBoard, patchSettings, exportJson, importJson };
}
