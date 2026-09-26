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
import { addSpares, SPARE_COUNT, spareHolderId, takeSpare } from "@/lib/board-spares";
import { generateRelatedTopics } from "@/lib/gemini";
import { topicContext } from "@/lib/topic-context";
import { fetchSharedRelated, notePick, recallTopicsNow } from "@/lib/knowledge-client";
import { loadIdentity } from "@/lib/identity";
import { layoutBoard, prefsFromSettings } from "@/lib/layout";
import { pickWeightedStarter, preferredForSeed } from "@/lib/popularity";
import { nextBoardName } from "@/lib/ids";
import { emptyBoard, exportSnapshot, parseSnapshot } from "@/lib/storage";
import { recordUsage } from "@/lib/usage";
import { boardMode, DEFAULT_MODE, pickModeStarter, isChatMode, withMode } from "@/lib/modes";
import type { AppSnapshot, Board, BoardMode, GenerateResult, HistoryEntry, Settings } from "@/lib/types";

function currentSnapshot(): AppSnapshot {
  return getBoardSnapshot();
}

const SHARE_KEY = "topicstream-nu:share-id";

/** 予備が尽きて AI に作り直しを頼んだあと、次に頼めるまでの間隔（無料枠を連打で使い切らないため） */
export const REGEN_COOLDOWN_MS = 15_000;

/** AI のお知らせは同じ種類を連続で出さない（上限は再読み込みまで1回、それ以外は10分に1回） */
const noticeShownAt = new Map<string, number>();
function showGenerateNotice(result: GenerateResult) {
  if (!result.warning) return;
  const kind = result.noticeKind ?? result.warning;
  const last = noticeShownAt.get(kind);
  const now = Date.now();
  if (last !== undefined && (kind === "quota" || now - last < 10 * 60_000)) return;
  noticeShownAt.set(kind, now);
  if (kind === "quota") toast.warning(result.warning, { duration: 8_000 });
  else toast.message(result.warning);
}

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
  const regeneratingRef = useRef(new Set<string>());
  const [regeneratingIds, setRegeneratingIds] = useState<string[]>([]);
  const [regenReadyAt, setRegenReadyAt] = useState(0);

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
      // この語を選んで広げた＝図鑑での票
      notePick(working, nodeId, "expand");

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
      const boardId = started.board.id;
      const slots = started.board.nodes.filter((node) => started.childIds.includes(node.id) && node.data.placeholder).length;
      const fillPrefs = () => {
        const snap = currentSnapshot();
        const target = snap.boards.find((item) => item.id === boardId);
        return prefsFromSettings(snap.settings, overlay, target?.pinnedNodeId ?? null);
      };
      // 予備を少し多めにもらい、「作り直す」を API なしで出せるようにする。届いた語はすぐカードへ。
      const result = await generateRelatedTopics({
        seed: parent.data.label,
        existing: existingLabels,
        count: slots + SPARE_COUNT,
        preferred: preferredForSeed(parent.data.label),
        // 「一番の失敗談」のような汎用のカードでも、何の話の中のお題かが伝わるように
        context: topicContext(started.board, nodeId),
        mode: started.board.mode,
        // トピック図鑑に十分たまっているお題は AI を呼ばずに出す
        recall: true,
        onTopic: (label) => {
          if (expandTokens.current.get(nodeId) !== token) return;
          updateBoardById(boardId, (item) => ops.fillNextPlaceholder(item, started.childIds, label, fillPrefs()).board);
        },
      });

      if (expandTokens.current.get(nodeId) !== token) {
        setBusy(false);
        return;
      }

      const latest = currentSnapshot();
      const latestBoard = latest.boards.find((item) => item.id === boardId) ?? started.board;
      const stillPresent = started.childIds.some((id) => latestBoard.nodes.some((node) => node.id === id));
      if (!stillPresent) {
        setBusy(false);
        return;
      }

      // 流れてきた語で埋まっていない分を最終結果で埋め、余りは予備として中央に持たせる
      const onBoard = new Set(latestBoard.nodes.map((node) => node.data.label));
      const unused = result.topics.filter((label) => !onBoard.has(label));
      const openSlots = latestBoard.nodes.filter((node) => started.childIds.includes(node.id) && node.data.placeholder).length;
      const holder = spareHolderId(latestBoard, started.childIds, nodeId);
      const filled = addSpares(
        ops.fillExpand(
          latestBoard,
          nodeId,
          started.childIds,
          unused.slice(0, openSlots),
          prefsFromSettings(latest.settings, overlay, latestBoard.pinnedNodeId),
        ),
        holder,
        unused.slice(openSlots),
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
      if (isChatMode(started.board.mode)) recordUsage(parent.data.label, "expands");
      setBusy(false);
      showGenerateNotice(result);
    },
    [persist, updateBoardById],
  );

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
      const defaultName = /^(新しいボード( \d+)?|\d+月\d+日の雑談)$/.test(target.name);
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
    const mode = boardMode(board);
    const topic = pickModeStarter(mode, labels) ?? pickWeightedStarter(labels);
    if (board && board.nodes.length > 0) {
      updateBoard((item) => ops.addRootNode(item, topic, prefsFromSettings(current.settings, false, item.pinnedNodeId)));
      toast.success(`新しいきっかけ: ${topic}`);
      return;
    }
    await startWithKeyword(topic, mode);
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
      if (!board || !node || regeneratingRef.current.has(nodeId)) return;
      const holderId = node.data.parentId;
      const parent = board.nodes.find((item) => item.id === node.data.parentId);
      const seed = parent?.data.label || node.data.label;
      let spare = holderId ? takeSpare(board, holderId) : { board, label: null };
      let recalled: string[] = [];
      if (!spare.label) {
        // 予備が尽きたら、まずトピック図鑑（自分とみんなの過去の結果・似たお題）から探す。AI は呼ばない。
        // みんなの分は広げたときに取ってきてある。読み込み直した後などで無ければ、次の作り直しに向けて取りに行く
        const mode = boardMode(board);
        void fetchSharedRelated(seed, mode);
        recalled = recallTopicsNow(seed, board.nodes.map((item) => item.data.label), 1 + SPARE_COUNT, mode).topics;
        if (recalled[0]) spare = { board, label: recalled[0] };
      }
      // 予備も図鑑の候補も無く、クールダウン中なら AI は呼ばない（ボタン側でも残り秒数を出している）
      if (!spare.label && Date.now() < regenReadyAt) {
        toast.message(`AI の作り直しは、あと ${Math.ceil((regenReadyAt - Date.now()) / 1000)} 秒で使えます`);
        return;
      }
      // 文が変わるので「いま話している」は外す
      if (board.pinnedNodeId === nodeId) {
        updateBoard((item) => ops.pinNode(item, null, prefsFromSettings(currentSnapshot().settings, false, null)));
      }
      regeneratingRef.current.add(nodeId);
      setRegeneratingIds([...regeneratingRef.current]);
      const prefs = () => {
        const snap = currentSnapshot();
        const target = snap.boards.find((item) => item.id === board.id);
        return prefsFromSettings(snap.settings, false, target?.pinnedNodeId ?? null);
      };
      try {
        if (recalled.length > 0) {
          // 図鑑から出す。残りは次の作り直し用の予備にする
          const [label, ...rest] = recalled;
          await new Promise((resolve) => window.setTimeout(resolve, 350));
          updateBoardById(board.id, (item) => {
            const relabeled = ops.setLabel(item, nodeId, label!, prefs());
            return holderId ? addSpares(relabeled, holderId, rest) : relabeled;
          });
          return;
        }
        if (spare.label) {
          // 展開のときにもらっておいた予備を使う（API を呼ばないので速い・枠も減らない）
          const label = spare.label;
          await new Promise((resolve) => window.setTimeout(resolve, 350));
          updateBoardById(board.id, (item) => {
            const taken = holderId ? takeSpare(item, holderId) : { board: item, label };
            return ops.setLabel(taken.board, nodeId, taken.label ?? label, prefs());
          });
          return;
        }
        setRegenReadyAt(Date.now() + REGEN_COOLDOWN_MS);
        // 1語だけのために呼ぶのはもったいないので、次の分の予備もまとめてもらう
        const [result] = await Promise.all([
          generateRelatedTopics({
            seed,
            existing: board.nodes.map((item) => item.data.label),
            count: 1 + SPARE_COUNT,
            preferred: preferredForSeed(seed),
            context: parent ? topicContext(board, parent.id) : [],
            mode: board.mode,
          }),
          new Promise((resolve) => window.setTimeout(resolve, 600)),
        ]);
        const [nextLabel, ...rest] = result.topics;
        if (nextLabel) {
          updateBoardById(board.id, (item) => {
            const relabeled = ops.setLabel(item, nodeId, nextLabel, prefs());
            return holderId ? addSpares(relabeled, holderId, rest) : relabeled;
          });
        }
        showGenerateNotice(result);
      } finally {
        regeneratingRef.current.delete(nodeId);
        setRegeneratingIds([...regeneratingRef.current]);
      }
    },
    [regenReadyAt, updateBoard, updateBoardById],
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
        const next = ops.setLabel(board, nodeId, label, prefsFromSettings(current.settings, false, board.pinnedNodeId));
        // 自分で書き直した語は、人が考えた話題として図鑑にも入れる
        notePick(next, nodeId, "edit");
        return next;
      }),
    [updateBoard],
  );
  const pinNode = useCallback(
    (nodeId: string | null) => {
      const board = currentSnapshot().boards.find((item) => item.id === currentSnapshot().activeBoardId);
      const label = nodeId ? board?.nodes.find((node) => node.id === nodeId)?.data.label : undefined;
      if (label && isChatMode(board?.mode)) recordUsage(label, "pins");
      if (board && nodeId) notePick(board, nodeId, "pin");
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
    (nodeId: string) =>
      updateBoard((board) => {
        const liked = !(board.nodes.find((node) => node.id === nodeId)?.data.heartCount ?? 0);
        if (liked) notePick(board, nodeId, "heart");
        return ops.toggleHeart(board, nodeId);
      }),
    [updateBoard],
  );
  const bumpHeart = useCallback(
    (nodeId: string, delta = 1) => updateBoard((board) => ops.bumpHeart(board, nodeId, delta)),
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

  const duplicateBoard = useCallback(
    (boardId?: string) => {
      const current = currentSnapshot();
      const board = current.boards.find((item) => item.id === (boardId ?? current.activeBoardId));
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
    },
    [persist],
  );

  const switchBoard = useCallback(
    (boardId: string) => {
      persist({ ...currentSnapshot(), activeBoardId: boardId });
      setUndoStack([]);
      setRedoStack([]);
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
      if (activeGone) {
        setUndoStack([]);
        setRedoStack([]);
      }
      toast.success("ボードを削除しました");
    },
    [persist],
  );

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
      if (isChatMode(board?.mode)) recordUsage(label, "copies");
      if (board) notePick(board, nodeId, "copy");
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
      toast.success("いっしょに見るリンクをコピーしました", {
        description: "リンクを知っている人はボードを見られます。個人情報は書かないでください。",
      });
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
    duplicateBoard,
    switchBoard,
    renameBoard,
    deleteBoard,
    resetActive,
    importCatalogBoard,
    patchSettings,
    exportJson,
    importJson,
    copyLabel,
    publishWatchLink,
    toggleHeart,
    regeneratingIds,
    regenReadyAt,
    bumpHeart,
    bumpFrameHearts,
  };
}

export type BoardController = ReturnType<typeof useBoardController>;
