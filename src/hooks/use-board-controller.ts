"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import * as ops from "@/lib/board-ops";
import {
  getBoardSnapshot,
  getServerBoardSnapshot,
  subscribeBoardStore,
  writeBoardSnapshot,
} from "@/lib/board-store";
import {
  clearHistory,
  getHistories,
  getServerHistories,
  historyOf,
  subscribeHistory,
  updateHistory,
} from "@/lib/board-history";
import { currentSnapshot, expandKey, pushUndo } from "@/lib/board-controller-helpers";
import { notePick } from "@/lib/knowledge-client";
import { prefsFromSettings } from "@/lib/layout";
import { pickWeightedStarter } from "@/lib/popularity";
import { emptyBoard } from "@/lib/storage";
import { recordUsage } from "@/lib/usage";
import { clearTalked, hasTalked, pickWeighted, rouletteCandidates, spinSequence } from "@/lib/roulette";
import { useBoardExpand } from "@/hooks/use-board-expand";
import { useBoardLibrary } from "@/hooks/use-board-library";
import { useBoardRegenerate } from "@/hooks/use-board-regenerate";
import { useWatchShare } from "@/hooks/use-watch-share";
import { setRouletteHighlight } from "@/hooks/use-roulette";
import { boardMode, DEFAULT_MODE, pickModeStarter, isChatMode, withMode } from "@/lib/modes";
import type { AppSnapshot, Board, BoardMode } from "@/lib/types";

export function useBoardController() {
  const snapshot = useSyncExternalStore(subscribeBoardStore, getBoardSnapshot, getServerBoardSnapshot);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  // 戻す／進むの履歴はボードごと。切り替えや再読み込みをしても消さない
  const histories = useSyncExternalStore(subscribeHistory, getHistories, getServerHistories);
  // 広げ直し・戻すたびに進めて、遅れて届いた広げ結果を捨てる（広げる側と共有する）
  const expandTokens = useRef(new Map<string, number>());
  /** 「ずれている」の印を付けた語。盤面から消えても、このあと AI・図鑑から出し直さない */
  const rejectedRef = useRef(new Set<string>());
  const spinningRef = useRef(false);
  /** 全部話し終えたときの「印を戻して回す」から、もう一度回す */
  const spinAgainRef = useRef<() => void>(() => undefined);
  const [spinning, setSpinning] = useState(false);

  const persist = useCallback((next: AppSnapshot) => {
    writeBoardSnapshot(next);
  }, []);

  const updateBoard = useCallback(
    (mutator: (board: Board) => Board, extra?: Partial<AppSnapshot>) => {
      const current = currentSnapshot();
      const boards = current.boards.map((board) =>
        board.id === current.activeBoardId ? mutator(board) : board,
      );
      persist({ ...current, ...extra, boards });
    },
    [persist],
  );

  /** 表示中かどうかに関係なく、指定のボードだけ書き換える（生成中にボードを切り替えても混ざらない） */
  const updateBoardById = useCallback(
    (boardId: string, mutator: (board: Board) => Board) => {
      const current = currentSnapshot();
      if (!current.boards.some((board) => board.id === boardId)) return;
      persist({ ...current, boards: current.boards.map((board) => (board.id === boardId ? mutator(board) : board)) });
    },
    [persist],
  );

  const activeBoard = useMemo(
    () => snapshot.boards.find((board) => board.id === snapshot.activeBoardId) ?? snapshot.boards[0] ?? null,
    [snapshot],
  );

  const { busy, expandNode, detailNode, combineNodes } = useBoardExpand({
    persist,
    updateBoardById,
    expandTokensRef: expandTokens,
    rejectedRef,
  });

  const startWithKeyword = useCallback(
    async (label: string, mode: BoardMode = DEFAULT_MODE) => {
      const current = currentSnapshot();
      if (!label.trim()) return;
      const active = current.boards.find((board) => board.id === current.activeBoardId);
      if (!active) return;
      // 今のボードに中身があるときは上書きせず別のボードで始める。
      // 空のボードが残っていればそれを使い、既定の名前ならキーワードに付け替える。
      const reuse = active.nodes.length === 0 ? active : current.boards.find((board) => board.nodes.length === 0);
      const target = reuse ?? emptyBoard();
      const defaultName = /^(新しい(ボード|マップ)( \d+)?|\d+月\d+日の雑談)$/.test(target.name);
      const renamed = !reuse || defaultName ? ops.renameBoard(target, label.trim().slice(0, 24)) : target;
      const named = withMode(renamed, mode);
      const rooted = ops.createRootBoard(named, label, prefsFromSettings(current.settings, false, named.pinnedNodeId));
      persist({
        ...current,
        activeBoardId: rooted.id,
        boards: reuse
          ? current.boards.map((board) => (board.id === rooted.id ? rooted : board))
          : [...current.boards, rooted],
      });
      clearHistory(rooted.id);
      const rootId = rooted.nodes[0]?.id;
      if (rootId) await expandNode(rootId);
    },
    [expandNode, persist],
  );

  const startRandom = useCallback(async () => {
    const current = currentSnapshot();
    const board = current.boards.find((item) => item.id === current.activeBoardId);
    const labels = board?.nodes.map((node) => node.data.label) ?? [];
    const mode = boardMode(board);
    const topic = pickModeStarter(mode, labels) ?? pickWeightedStarter(labels);
    if (board && board.nodes.length > 0) {
      // 戻すと、足したカードを消して前に選んでいたカードへ戻る
      const previousFocus =
        board.nodes.find((node) => node.id === board.focusedNodeId)?.id ?? board.nodes.find((node) => node.data.parentId === null)?.id;
      let rootId: string | null = null;
      updateBoard((item) => {
        const next = ops.addRootNode(item, topic, prefsFromSettings(current.settings, false, item.pinnedNodeId));
        rootId = next.focusedNodeId;
        return next;
      });
      const added = currentSnapshot().boards.find((item) => item.id === board.id);
      // 新しいカードが、戻した 3×3 の番号を使うことがある。進む履歴を残すと番号が重なる（pushUndo が進む履歴を消す）
      if (added && rootId && previousFocus) pushUndo(board.id, ops.historyFromChildren(added, previousFocus, [rootId], []));
      else updateHistory(board.id, (history) => ({ ...history, redo: [] }));
      toast.success(`新しいお題: ${topic}`, { description: "取り消すときは「1つ戻る」" });
      return;
    }
    await startWithKeyword(topic, mode);
  }, [startWithKeyword, updateBoard]);

  const undo = useCallback(() => {
    const current = currentSnapshot();
    const board = current.boards.find((item) => item.id === current.activeBoardId);
    const action = board ? historyOf(board.id).undo.at(-1) : undefined;
    if (!board || !action) {
      toast.message("戻せる操作がありません");
      return;
    }
    // 広げた操作を戻すときだけ、親の広げ途中も止める。R・お題箱の採用は「選んでいたカード」を親として覚えているだけなので、
    // そのカードが別に広げている途中なら止めない（止めると空のカードが残ったままになる）
    const opened = board.nodes.some((node) => action.childIds.includes(node.id) && node.data.parentId === action.parentId);
    for (const id of opened ? [action.parentId, ...action.childIds] : action.childIds) {
      const key = expandKey(board.id, id);
      expandTokens.current.set(key, (expandTokens.current.get(key) ?? 0) + 1);
    }
    const captured = {
      ...ops.historyFromChildren(board, action.parentId, action.childIds, action.edgeIds),
      replaced: action.replaced,
    };
    // 広げている途中（空のカードが残っている）なら、進むで空のカードが戻ってこないよう進む側に積まない
    const unfinished = captured.nodes.some((node) => node.data.placeholder);
    updateHistory(board.id, (history) => ({
      undo: history.undo.slice(0, -1),
      redo: unfinished ? history.redo : [...history.redo, captured],
    }));
    updateBoard((item) => {
      const undone = ops.undoExpand(item, action);
      return action.replaced ? ops.redoExpand(undone, action.replaced) : undone;
    });
    toast.success("1つ戻しました");
  }, [updateBoard]);

  const redo = useCallback(() => {
    const current = currentSnapshot();
    const boardId = current.activeBoardId;
    const action = historyOf(boardId).redo.at(-1);
    if (!boardId || !action) {
      toast.message("進める操作がありません");
      return;
    }
    updateHistory(boardId, (history) => ({ undo: [...history.undo, action], redo: history.redo.slice(0, -1) }));
    updateBoard((item) => ops.redoExpand(action.replaced ? ops.undoExpand(item, action.replaced) : item, action));
    toast.success("進みました");
  }, [updateBoard]);

  const { regeneratingIds, regenReadyAt, regenerateNode, rejectNode } = useBoardRegenerate({
    updateBoardById,
    rejectedRef,
  });

  const setMemo = useCallback(
    (nodeId: string, memo: string) =>
      updateBoard((board) => {
        const current = currentSnapshot();
        return ops.setMemo(board, nodeId, memo, prefsFromSettings(current.settings, false, board.pinnedNodeId));
      }),
    [updateBoard],
  );
  const setLabel = useCallback(
    (nodeId: string, label: string) =>
      updateBoard((board) => {
        const current = currentSnapshot();
        const next = ops.setLabel(board, nodeId, label, prefsFromSettings(current.settings, false, board.pinnedNodeId));
        // 自分で書き直した語は、人が考えた話題として図鑑にも入れる（開いて閉じただけ・空にしただけなら数えない）
        if (next !== board) notePick(next, nodeId, "edit");
        return next;
      }),
    [updateBoard],
  );
  const pinNode = useCallback(
    (nodeId: string | null) => {
      const board = currentSnapshot().boards.find((item) => item.id === currentSnapshot().activeBoardId);
      // 同じカードでもう一度押すと NOW を外す。外すときは票に数えない
      const pinning = Boolean(nodeId && board?.pinnedNodeId !== nodeId);
      const label = pinning ? board?.nodes.find((node) => node.id === nodeId)?.data.label : undefined;
      if (label && isChatMode(board?.mode)) recordUsage(label, "pins");
      if (board && nodeId && pinning) notePick(board, nodeId, "pin");
      updateBoard((item) => {
        const current = currentSnapshot();
        return ops.pinNode(item, nodeId, prefsFromSettings(current.settings, false, item.pinnedNodeId));
      });
    },
    [updateBoard],
  );
  const focusNode = useCallback(
    (nodeId: string | null) => updateBoard((board) => ops.focusNode(board, nodeId)),
    [updateBoard],
  );

  /**
   * お題箱のお題を採用する: 今のボードに新しいカードを足して NOW にし、8 つに広げる。
   * 「1つ戻る」1 回目で広げた 8 枚、2 回目でカードが消える（ルーレットの新しいきっかけ → 広げると同じ）
   */
  const adoptListenerTopic = useCallback(
    async (topic: string) => {
      const current = currentSnapshot();
      const board = current.boards.find((item) => item.id === current.activeBoardId);
      if (!board || !topic.trim()) return;
      const previousFocus =
        board.nodes.find((node) => node.id === board.focusedNodeId)?.id ?? board.nodes.find((node) => node.data.parentId === null)?.id;
      updateBoard((item) => {
        const next = ops.addRootNode(item, topic, prefsFromSettings(current.settings, false, item.pinnedNodeId));
        return {
          ...next,
          nodes: next.nodes.map((node) =>
            node.id === next.focusedNodeId ? { ...node, data: { ...node.data, fromListener: true } } : node,
          ),
        };
      });
      const added = currentSnapshot().boards.find((item) => item.id === board.id);
      const rootId = added?.focusedNodeId;
      if (!added || !rootId) return;
      if (previousFocus) pushUndo(board.id, ops.historyFromChildren(added, previousFocus, [rootId], []));
      else updateHistory(board.id, (history) => ({ ...history, redo: [] }));
      pinNode(rootId);
      toast.success(`リスナーのお題: ${topic}`, { description: "取り消すときは「1つ戻る」を 2 回" });
      await expandNode(rootId);
    },
    [expandNode, pinNode, updateBoard],
  );

  /**
   * 話題ルーレット: まだ話していないカードを順に光らせて、止まったカードを NOW にする。
   * 視聴者のハートが多いカードほど当たりやすい。偶然選んだだけなので、図鑑の票には数えない
   */
  const spinRoulette = useCallback(async () => {
    if (spinningRef.current) return;
    const board = currentSnapshot().boards.find((item) => item.id === currentSnapshot().activeBoardId);
    if (!board) return;
    const candidates = rouletteCandidates(board);
    const winner = pickWeighted(candidates);
    if (!winner) {
      if (hasTalked(board)) {
        // 全部話し終えた（前の配信のボードを使い直したときも）。印を戻せば、また同じカードから選べる
        toast.message("まだ話していないカードがありません", {
          description: "カードを広げて増やすか、「話した」の印を戻して回せます",
          action: {
            label: "印を戻して回す",
            onClick: () => {
              updateBoardById(board.id, clearTalked);
              spinAgainRef.current();
            },
          },
        });
        return;
      }
      toast.message(board.nodes.length > 1 ? "まだ話していないカードがありません" : "先にお題を広げてください", {
        description: "カードを広げると、ルーレットで選べる話題が増えます",
      });
      return;
    }
    spinningRef.current = true;
    setSpinning(true);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    try {
      for (const step of spinSequence(candidates, winner, Math.random, reduced)) {
        setRouletteHighlight(step.id);
        if (step.delay > 0) await new Promise((resolve) => window.setTimeout(resolve, step.delay));
      }
      setRouletteHighlight(winner.id, true);
      // 回っている間にカードが消えていたら（戻した・作り直した）何もしない
      const latest = currentSnapshot().boards.find((item) => item.id === board.id);
      const landed = latest?.nodes.find((node) => node.id === winner.id);
      if (!latest || !landed) return;
      updateBoardById(board.id, (item) =>
        ops.focusNode(
          ops.pinNode(item, winner.id, prefsFromSettings(currentSnapshot().settings, false, winner.id)),
          winner.id,
        ),
      );
      toast.success(`次の話題は「${landed.data.label}」`, { duration: 4_000 });
      await new Promise((resolve) => window.setTimeout(resolve, 1_600));
    } finally {
      setRouletteHighlight(null);
      spinningRef.current = false;
      setSpinning(false);
    }
  }, [updateBoardById]);
  useEffect(() => {
    spinAgainRef.current = () => void spinRoulette();
  }, [spinRoulette]);

  const toggleHeart = useCallback(
    (nodeId: string) =>
      updateBoard((board) => {
        const liked = !(board.nodes.find((node) => node.id === nodeId)?.data.heartCount ?? 0);
        if (liked) notePick(board, nodeId, "heart");
        return ops.toggleHeart(board, nodeId);
      }),
    [updateBoard],
  );
  const bumpFrameHearts = useCallback(
    (nodeId: string, delta = 1) =>
      updateBoard((board) => {
        // 視聴者がコメントで「1Eが聞きたい」などとハートを送った
        if (delta > 0) notePick(board, nodeId, "chat");
        return ops.bumpFrameHearts(board, nodeId, delta);
      }),
    [updateBoard],
  );

  const { switchBoard, renameBoard, deleteBoard, importCatalogBoard, patchSettings, exportJson, importJson } =
    useBoardLibrary(persist);

  const copyLabel = useCallback(async (nodeId: string) => {
    const current = currentSnapshot();
    const board = current.boards.find((item) => item.id === current.activeBoardId);
    const label = board?.nodes.find((node) => node.id === nodeId)?.data.label;
    if (!label) return;
    try {
      await navigator.clipboard.writeText(label);
      if (isChatMode(board?.mode)) recordUsage(label, "copies");
      if (board) notePick(board, nodeId, "copy");
      toast.success(`「${label}」をコピーしました`);
    } catch {
      toast.error("コピーできませんでした");
    }
  }, []);

  const { shareId, publishWatchLink } = useWatchShare(activeBoard, snapshot.settings.streamUrl);

  return {
    hydrated: mounted,
    snapshot,
    activeBoard,
    settings: snapshot.settings,
    undoStack: (activeBoard && histories[activeBoard.id]?.undo) || [],
    redoStack: (activeBoard && histories[activeBoard.id]?.redo) || [],
    busy,
    shareId,
    startWithKeyword,
    startRandom,
    expandNode,
    regenerateNode,
    rejectNode,
    detailNode,
    combineNodes,
    undo,
    redo,
    setMemo,
    setLabel,
    pinNode,
    focusNode,
    adoptListenerTopic,
    spinRoulette,
    spinning,
    switchBoard,
    renameBoard,
    deleteBoard,
    importCatalogBoard,
    patchSettings,
    exportJson,
    importJson,
    copyLabel,
    publishWatchLink,
    toggleHeart,
    regeneratingIds,
    regenReadyAt,
    bumpFrameHearts,
  };
}

export type BoardController = ReturnType<typeof useBoardController>;
