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
import { catalogBoardToBoard, type CatalogBoard } from "@/lib/catalog-data";
import { generateRelatedTopics } from "@/lib/gemini";
import { loadIdentity } from "@/lib/identity";
import { layoutBoard, prefsFromSettings } from "@/lib/layout";
import { pickWeightedStarter, preferredForSeed } from "@/lib/popularity";
import { nextBoardName } from "@/lib/ids";
import { emptyBoard, exportSnapshot, parseSnapshot } from "@/lib/storage";
import { recordUsage } from "@/lib/usage";
import type { AppSnapshot, Board, HistoryEntry, Settings } from "@/lib/types";

function currentSnapshot(): AppSnapshot {
  return getBoardSnapshot();
}

const SHARE_KEY = "topicstream-nu:share-id";

export function useBoardController() {
  const snapshot = useSyncExternalStore(subscribeBoardStore, getBoardSnapshot, getServerBoardSnapshot);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const expandTokens = useRef(new Map<string, number>());

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

  const activeBoard = useMemo(
    () => snapshot.boards.find((board) => board.id === snapshot.activeBoardId) ?? snapshot.boards[0] ?? null,
    [snapshot],
  );

  const expandNode = useCallback(
    async (nodeId: string, replace = false, overlay = false) => {
      const current = currentSnapshot();
      const board = current.boards.find((item) => item.id === current.activeBoardId);
      if (!board) return;
      let working = board;
      if (replace) {
        const cleared = ops.clearChildren(working, nodeId);
        working = cleared.board;
        if (cleared.history) {
          setUndoStack((stack) => [...stack, cleared.history!].slice(-40));
          setRedoStack([]);
        }
      }
      const parent = working.nodes.find((node) => node.id === nodeId);
      if (!parent || parent.data.expanding) return;

      const prefs = prefsFromSettings(current.settings, overlay, working.pinnedNodeId);
      const started = ops.beginExpand(working, nodeId, 8, prefs);
      if (!started) return;

      const token = (expandTokens.current.get(nodeId) ?? 0) + 1;
      expandTokens.current.set(nodeId, token);
      persist({
        ...current,
        boards: current.boards.map((item) => (item.id === started.board.id ? started.board : item)),
      });
      setUndoStack((stack) =>
        [...stack, ops.historyFromChildren(started.board, nodeId, started.childIds, started.edgeIds)].slice(-40),
      );
      setRedoStack([]);
      setBusy(true);

      const existingLabels = started.board.nodes.map((node) => node.data.label);
      const result = await generateRelatedTopics({
        seed: parent.data.label,
        existing: existingLabels,
        apiKey: current.settings.geminiApiKey,
        model: current.settings.geminiModel,
        preferred: preferredForSeed(parent.data.label),
      });

      if (expandTokens.current.get(nodeId) !== token) {
        setBusy(false);
        return;
      }

      const latest = currentSnapshot();
      const latestBoard = latest.boards.find((item) => item.id === latest.activeBoardId) ?? started.board;
      const stillPresent = started.childIds.some((id) => latestBoard.nodes.some((node) => node.id === id));
      if (!stillPresent) {
        setBusy(false);
        return;
      }

      const filled = ops.fillExpand(
        latestBoard,
        nodeId,
        started.childIds,
        result.topics,
        prefsFromSettings(latest.settings, overlay, latestBoard.pinnedNodeId),
      );
      persist({
        ...latest,
        boards: latest.boards.map((item) => (item.id === filled.id ? filled : item)),
      });
      setUndoStack((stack) => {
        const next = [...stack];
        for (let i = next.length - 1; i >= 0; i -= 1) {
          const entry = next[i]!;
          if (
            entry.parentId === nodeId &&
            entry.childIds.length === started.childIds.length &&
            entry.childIds.every((id, index) => id === started.childIds[index])
          ) {
            next[i] = ops.historyFromChildren(filled, nodeId, started.childIds, started.edgeIds);
            break;
          }
        }
        return next;
      });
      recordUsage(parent.data.label, "expands");
      setBusy(false);
      if (result.warning) toast.message(result.warning);
    },
    [persist],
  );

  const startWithKeyword = useCallback(
    async (label: string) => {
      const current = currentSnapshot();
      if (!label.trim()) return;
      const existing = current.boards.find((board) => board.id === current.activeBoardId);
      if (!existing) return;
      const rooted = ops.createRootBoard(existing, label, prefsFromSettings(current.settings, false, existing.pinnedNodeId));
      persist({ ...current, boards: current.boards.map((board) => (board.id === rooted.id ? rooted : board)) });
      setUndoStack([]);
      setRedoStack([]);
      const rootId = rooted.nodes[0]?.id;
      if (rootId) await expandNode(rootId);
    },
    [expandNode, persist],
  );

  const startRandom = useCallback(async () => {
    const current = currentSnapshot();
    const board = current.boards.find((item) => item.id === current.activeBoardId);
    const labels = board?.nodes.map((node) => node.data.label) ?? [];
    const topic = pickWeightedStarter(labels);
    if (board && board.nodes.length > 0) {
      updateBoard((item) => ops.addRootNode(item, topic, prefsFromSettings(current.settings, false, item.pinnedNodeId)));
      toast.success(`新しいきっかけ: ${topic}`);
      return;
    }
    await startWithKeyword(topic);
  }, [startWithKeyword, updateBoard]);

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      const action = stack[stack.length - 1];
      if (!action) {
        queueMicrotask(() => toast.message("戻せる操作がありません"));
        return stack;
      }
      expandTokens.current.set(action.parentId, (expandTokens.current.get(action.parentId) ?? 0) + 1);
      for (const id of action.childIds) {
        expandTokens.current.set(id, (expandTokens.current.get(id) ?? 0) + 1);
      }
      const current = currentSnapshot();
      const board = current.boards.find((item) => item.id === current.activeBoardId);
      const captured = board
        ? ops.historyFromChildren(board, action.parentId, action.childIds, action.edgeIds)
        : null;
      queueMicrotask(() => {
        if (captured) setRedoStack((redo) => [...redo, captured].slice(-40));
        updateBoard((item) => ops.undoExpand(item, action));
        toast.success("ひとつ戻しました");
      });
      return stack.slice(0, -1);
    });
  }, [updateBoard]);

  const redo = useCallback(() => {
    setRedoStack((stack) => {
      const action = stack[stack.length - 1];
      if (!action) {
        queueMicrotask(() => toast.message("進める操作がありません"));
        return stack;
      }
      queueMicrotask(() => {
        updateBoard((item) => ops.redoExpand(item, action));
        setUndoStack((undo) => [...undo, action].slice(-40));
        toast.success("進みました");
      });
      return stack.slice(0, -1);
    });
  }, [updateBoard]);

  const regenerateNode = useCallback(
    async (nodeId: string) => {
      const current = currentSnapshot();
      const board = current.boards.find((item) => item.id === current.activeBoardId);
      const node = board?.nodes.find((item) => item.id === nodeId);
      if (!board || !node) return;
      toast.message("このマスの文だけ作り直します");
      const parent = board.nodes.find((item) => item.id === node.data.parentId);
      const result = await generateRelatedTopics({
        seed: parent?.data.label || node.data.label,
        existing: board.nodes.map((item) => item.data.label),
        apiKey: current.settings.geminiApiKey,
        model: current.settings.geminiModel,
        count: 1,
        preferred: preferredForSeed(parent?.data.label || node.data.label),
      });
      const nextLabel = result.topics[0];
      if (!nextLabel) return;
      updateBoard((item) =>
        ops.setLabel(item, nodeId, nextLabel, prefsFromSettings(currentSnapshot().settings, false, item.pinnedNodeId)),
      );
      if (result.warning) toast.message(result.warning);
    },
    [updateBoard],
  );

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
        return ops.setLabel(board, nodeId, label, prefsFromSettings(current.settings, false, board.pinnedNodeId));
      }),
    [updateBoard],
  );
  const pinNode = useCallback(
    (nodeId: string | null) => {
      const board = currentSnapshot().boards.find((item) => item.id === currentSnapshot().activeBoardId);
      const label = nodeId ? board?.nodes.find((node) => node.id === nodeId)?.data.label : undefined;
      if (label) recordUsage(label, "pins");
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
  const syncPositions = useCallback(
    (positions: Record<string, { x: number; y: number }>) =>
      updateBoard((board) => ops.syncPositions(board, positions)),
    [updateBoard],
  );

  const toggleHeart = useCallback(
    (nodeId: string) => updateBoard((board) => ops.toggleHeart(board, nodeId)),
    [updateBoard],
  );
  const bumpHeart = useCallback(
    (nodeId: string, delta = 1) => updateBoard((board) => ops.bumpHeart(board, nodeId, delta)),
    [updateBoard],
  );

  const createBoard = useCallback(
    (name?: string) => {
      const current = currentSnapshot();
      const board = emptyBoard(name ?? nextBoardName(current.boards.map((item) => item.name)));
      persist({
        ...current,
        boards: [...current.boards, board],
        activeBoardId: board.id,
      });
      setUndoStack([]);
      setRedoStack([]);
      toast.success(`「${board.name}」を始めます`);
    },
    [persist],
  );

  const duplicateActive = useCallback(() => {
    const current = currentSnapshot();
    const board = current.boards.find((item) => item.id === current.activeBoardId);
    if (!board) return;
    const copy = ops.duplicateBoard(board);
    persist({
      ...current,
      boards: [...current.boards, copy],
      activeBoardId: copy.id,
    });
    setUndoStack([]);
    setRedoStack([]);
    toast.success(`「${copy.name}」を複製しました`);
  }, [persist]);

  const switchBoard = useCallback(
    (boardId: string) => {
      persist({ ...currentSnapshot(), activeBoardId: boardId });
      setUndoStack([]);
      setRedoStack([]);
    },
    [persist],
  );

  const renameActive = useCallback(
    (name: string) => updateBoard((board) => ops.renameBoard(board, name)),
    [updateBoard],
  );

  const deleteActive = useCallback(() => {
    const current = currentSnapshot();
    if (current.boards.length <= 1) {
      toast.error("最後のボードは削除できません");
      return;
    }
    const remaining = current.boards.filter((board) => board.id !== current.activeBoardId);
    persist({
      ...current,
      boards: remaining,
      activeBoardId: remaining[0]!.id,
    });
    setUndoStack([]);
    setRedoStack([]);
    toast.success("ボードを削除しました");
  }, [persist]);

  const resetActive = useCallback(() => {
    updateBoard((board) => ({
      ...board,
      nodes: [],
      edges: [],
      pinnedNodeId: null,
      focusedNodeId: null,
      updatedAt: Date.now(),
    }));
    setUndoStack([]);
    setRedoStack([]);
    toast.success("ボードを空にしました");
  }, [updateBoard]);

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
      setUndoStack([]);
      setRedoStack([]);
      toast.success(`「${board.name}」を取り込みました`);
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
    URL.revokeObjectURL(url);
    toast.success("JSONを書き出しました（APIキーは含みません）");
  }, []);

  const importJson = useCallback((text: string) => {
    try {
      const parsed = parseSnapshot(JSON.parse(text));
      const current = currentSnapshot();
      persist({
        ...parsed,
        settings: {
          ...parsed.settings,
          geminiApiKey: parsed.settings.geminiApiKey || current.settings.geminiApiKey || "",
        },
      });
      setUndoStack([]);
      setRedoStack([]);
      toast.success("ボードを読み込みました");
    } catch {
      toast.error("JSONを読み込めませんでした");
    }
  }, [persist]);

  const copyLabel = useCallback(async (nodeId: string) => {
    const current = currentSnapshot();
    const board = current.boards.find((item) => item.id === current.activeBoardId);
    const label = board?.nodes.find((node) => node.id === nodeId)?.data.label;
    if (!label) return;
    try {
      await navigator.clipboard.writeText(label);
      recordUsage(label, "copies");
      toast.success(`「${label}」をコピーしました`);
    } catch {
      toast.error("コピーできませんでした");
    }
  }, []);

  const publishWatchLink = useCallback(async () => {
    const current = currentSnapshot();
    const board = current.boards.find((item) => item.id === current.activeBoardId);
    if (!board || board.nodes.length === 0) {
      toast.error("共有する話題がまだありません");
      return;
    }
    const nickname = current.settings.nickname || loadIdentity().nickname;
    const existing = shareId ?? window.sessionStorage.getItem(SHARE_KEY);
    const response = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: existing ?? undefined, board, nickname }),
    });
    if (!response.ok) {
      toast.error("共有リンクを作れませんでした");
      return;
    }
    const json = (await response.json()) as { id: string };
    setShareId(json.id);
    window.sessionStorage.setItem(SHARE_KEY, json.id);
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const url = `${window.location.origin}${base}/watch?id=${encodeURIComponent(json.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("いっしょに見るリンクをコピーしました");
    } catch {
      toast.message(url);
    }
  }, [shareId]);

  useEffect(() => {
    if (!shareId || !activeBoard || activeBoard.nodes.length === 0) return;
    const timer = window.setTimeout(() => {
      const current = currentSnapshot();
      void fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: shareId,
          board: activeBoard,
          nickname: current.settings.nickname || loadIdentity().nickname,
        }),
      }).catch(() => undefined);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [activeBoard, shareId]);

  return {
    hydrated: mounted,
    snapshot,
    activeBoard,
    settings: snapshot.settings,
    undoStack,
    redoStack,
    busy,
    shareId,
    startWithKeyword,
    startRandom,
    expandNode,
    regenerateNode,
    undo,
    redo,
    setMemo,
    setLabel,
    pinNode,
    focusNode,
    syncPositions,
    createBoard,
    duplicateActive,
    switchBoard,
    renameActive,
    deleteActive,
    resetActive,
    importCatalogBoard,
    patchSettings,
    exportJson,
    importJson,
    copyLabel,
    publishWatchLink,
    toggleHeart,
    bumpHeart,
  };
}

export type BoardController = ReturnType<typeof useBoardController>;
