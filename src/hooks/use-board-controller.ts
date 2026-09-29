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
import { catalogBoardToBoard, type CatalogBoard } from "@/lib/catalog-data";
import { addMixNode, canCombine, existingMix } from "@/lib/board-combine";
import { addSpares, SPARE_COUNT, spareHolderId, takeSpare } from "@/lib/board-spares";
import { generateRelatedTopics } from "@/lib/gemini";
import type { GeminiWaitStage } from "@/lib/gemini-core";
import { createPacer, REVEAL_GAP_MS, STAGGER_REVEAL, WAIT_QUIPS, waitNote } from "@/lib/expand-wait";
import { topicContext } from "@/lib/topic-context";
import { detailRecordSeed } from "@/lib/detail-modes";
import { fetchSharedRelated, notePick, recallTopicsNow } from "@/lib/knowledge-client";
import { loadIdentity } from "@/lib/identity";
import { layoutBoard, prefsFromSettings } from "@/lib/layout";
import { pickWeightedStarter, preferredForSeed } from "@/lib/popularity";
import { nextBoardName } from "@/lib/ids";
import { emptyBoard, exportSnapshot, parseImportedBoards } from "@/lib/storage";
import { recordUsage } from "@/lib/usage";
import { boardMode, DEFAULT_MODE, pickModeStarter, isChatMode, withMode } from "@/lib/modes";
import type { AppSnapshot, Board, BoardMode, GenerateResult, HistoryEntry, Settings } from "@/lib/types";

function currentSnapshot(): AppSnapshot {
  return getBoardSnapshot();
}

const SHARE_KEY = "topicstream-nu:share-id";
/** いっしょに見るリンクを書き換えるための鍵（作ったタブだけが持つ） */
const SHARE_OWNER_KEY = "topicstream-nu:share-key";

function readShareSession(): { id: string | null; key: string | null } {
  try {
    return { id: window.sessionStorage.getItem(SHARE_KEY), key: window.sessionStorage.getItem(SHARE_OWNER_KEY) };
  } catch {
    return { id: null, key: null };
  }
}

function writeShareSession(value: { id: string; key: string } | null) {
  try {
    if (value) {
      window.sessionStorage.setItem(SHARE_KEY, value.id);
      window.sessionStorage.setItem(SHARE_OWNER_KEY, value.key);
    } else {
      window.sessionStorage.removeItem(SHARE_KEY);
      window.sessionStorage.removeItem(SHARE_OWNER_KEY);
    }
  } catch {
    /* 残せなくても、このページを開いている間は共有を続けられる */
  }
}

/** 共有ボードを送る。forbidden はリンクの持ち主ではない（別の端末・鍵が無い） */
async function postShare(
  share: { id: string | null; key: string | null },
  board: Board,
  nickname: string,
): Promise<{ id: string; key: string } | "forbidden" | null> {
  const response = await fetch("/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: share.id ?? undefined, key: share.key ?? undefined, board: withoutMemos(board), nickname }),
  }).catch(() => null);
  if (response?.status === 403) return "forbidden";
  if (!response?.ok) return null;
  const json = (await response.json().catch(() => null)) as { id?: unknown; key?: unknown } | null;
  return typeof json?.id === "string" && typeof json.key === "string" ? { id: json.id, key: json.key } : null;
}

/** 付箋は自分用のメモなので、いっしょに見るリンクにも載せない（サーバーへ送らない） */
function withoutMemos(board: Board): Board {
  return { ...board, nodes: board.nodes.map((node) => (node.data.memo ? { ...node, data: { ...node.data, memo: "" } } : node)) };
}

/** 予備が尽きて AI に作り直しを頼んだあと、次に頼めるまでの間隔（無料枠を連打で使い切らないため） */
export const REGEN_COOLDOWN_MS = 15_000;

/**
 * 待ちが長引いたら、今の状況（別の AI に聞き直している等）と和ませる一言を小さく出し続ける。
 * 10 秒より早く終われば何も出さない。stop で消す
 */
function startWaitNotes(key: string) {
  const started = Date.now();
  const id = `wait-${key}`;
  const offset = Math.floor(Math.random() * WAIT_QUIPS.length);
  let stage: GeminiWaitStage | undefined;
  let shown = false;
  const tick = () => {
    const note = waitNote(Date.now() - started, stage, offset);
    if (!note) return;
    shown = true;
    toast.loading(note.title, { id, description: note.quip });
  };
  const timer = window.setInterval(tick, 1_000);
  return {
    stage(next: GeminiWaitStage) {
      stage = next;
      tick();
    },
    stop() {
      window.clearInterval(timer);
      if (shown) toast.dismiss(id);
    },
  };
}

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

/**
 * お悩み相談などで深く広げたとき、中心のお題に寄せて広げていることを一度だけ知らせる（ボードごと・再読み込みまで）。
 * 雑談は話が広がるのが楽しいので寄せない（知らせもしない）。
 */
const anchorNoticeShown = new Set<string>();
function showAnchorNotice(board: Board, context: string[]) {
  const root = context[context.length - 1];
  if (isChatMode(boardMode(board)) || context.length < 2 || !root || anchorNoticeShown.has(board.id)) return;
  anchorNoticeShown.add(board.id);
  toast.message(`中心の「${root}」から離れないように広げています`, {
    description: "もっと寄せたいときは、カードを中心のカードに重ねると掛け合わせられます。",
    duration: 6_000,
  });
}

/** 新しい操作をしたら、進む履歴は捨てる */
function pushUndo(boardId: string, entry: HistoryEntry) {
  updateHistory(boardId, (history) => ({ undo: [...history.undo, entry], redo: [] }));
}

export function useBoardController() {
  const snapshot = useSyncExternalStore(subscribeBoardStore, getBoardSnapshot, getServerBoardSnapshot);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  // 戻す／進むの履歴はボードごと。切り替えや再読み込みをしても消さない
  const histories = useSyncExternalStore(subscribeHistory, getHistories, getServerHistories);
  const [busy, setBusy] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const expandTokens = useRef(new Map<string, number>());
  const regeneratingRef = useRef(new Set<string>());
  const [regeneratingIds, setRegeneratingIds] = useState<string[]>([]);
  const [regenReadyAt, setRegenReadyAt] = useState(0);
  /** 「ずれている」の印を付けた語。盤面から消えても、このあと AI・図鑑から出し直さない */
  const rejectedRef = useRef(new Set<string>());

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

  /**
   * カードを広げる。detail（「具体的にする」）は、切り口ではなく対応策・答え・話し方の例を短い文で出す
   * （形はふつうの広げ方と同じ 3×3。出した答えのカードも、ふつうのカードと同じように広げられる）。
   */
  const expandNode = useCallback(
    async (
      nodeId: string,
      replace = false,
      overlay = false,
      detail = false,
      /** 掛け合わせ: 「1つ戻る」で掛け合わせのカードごと消えるよう、重ねた先を親として記録する */
      historyRoot?: { parentId: string; childIds: string[]; edgeIds: string[] },
    ) => {
      const current = currentSnapshot();
      const board = current.boards.find((item) => item.id === current.activeBoardId);
      if (!board) return;
      let working = board;
      /** 作り直しで消した前の 8 枚（AI が答えなかったときに戻す） */
      let clearedHistory: HistoryEntry | null = null;
      if (replace) {
        const cleared = ops.clearChildren(working, nodeId);
        clearedHistory = cleared.history;
        // 前に広げたときの予備は捨てる（「具体的にする」で作り直した後に、元の切り口の語が混ざらないように）
        working = {
          ...cleared.board,
          nodes: cleared.board.nodes.map((node) =>
            node.id === nodeId ? { ...node, data: { ...node.data, spares: undefined } } : node,
          ),
        };
      }
      const parent = working.nodes.find((node) => node.id === nodeId);
      if (!parent || parent.data.expanding || parent.data.placeholder) return;
      // 広げ済みのカードは作り直し（replace）のときだけ広げ直す（E キーの連打で 3×3 が増えないように）
      if (!replace && parent.data.expanded) return;
      // この語を選んで広げた＝図鑑での票（掛け合わせの「A × B」は選ばれた語ではないので数えない）
      if (!parent.data.mixedFromId) notePick(working, nodeId, "expand");

      const prefs = prefsFromSettings(current.settings, overlay, working.pinnedNodeId);
      const begun = ops.beginExpand(working, nodeId, 8, prefs);
      if (!begun) return;
      const started = detail ? { ...begun, board: ops.markDetail(begun.board, begun.childIds) } : begun;

      const token = (expandTokens.current.get(nodeId) ?? 0) + 1;
      expandTokens.current.set(nodeId, token);
      persist({
        ...current,
        boards: current.boards.map((item) => (item.id === started.board.id ? started.board : item)),
      });
      const hist = historyRoot ?? { parentId: nodeId, childIds: started.childIds, edgeIds: started.edgeIds };
      // 作り直しは、差し替える前の 8 枚も同じ履歴に持たせる（「1つ戻る」で元の 8 枚に戻る）
      pushUndo(started.board.id, {
        ...ops.historyFromChildren(started.board, hist.parentId, hist.childIds, hist.edgeIds),
        replaced: clearedHistory ?? undefined,
      });
      setBusy(true);
      try {

        const existingLabels = [...started.board.nodes.map((node) => node.data.label), ...rejectedRef.current];
        const boardId = started.board.id;
        const slots = started.board.nodes.filter((node) => started.childIds.includes(node.id) && node.data.placeholder).length;
        const fillPrefs = () => {
          const snap = currentSnapshot();
          const target = snap.boards.find((item) => item.id === boardId);
          return prefsFromSettings(snap.settings, overlay, target?.pinnedNodeId ?? null);
        };
        const context = topicContext(started.board, nodeId);
        showAnchorNotice(started.board, context);
        // 予備を少し多めにもらい、「作り直す」を API なしで出せるようにする。届いた語はすぐカードへ（STAGGER_REVEAL なら少しずつずらす）
        const pacer = createPacer(STAGGER_REVEAL ? REVEAL_GAP_MS : 0);
        const revealed = () => expandTokens.current.get(nodeId) === token;
        const reveal = (label: string) =>
          pacer.push(() => {
            if (!revealed()) return;
            updateBoardById(boardId, (item) => ops.fillNextPlaceholder(item, started.childIds, label, fillPrefs()).board);
          });
        // 配信画面（オーバーレイ）には内部の事情を出さない
        const notes = overlay ? null : startWaitNotes(nodeId);
        const result = await generateRelatedTopics({
          seed: parent.data.label,
          existing: existingLabels,
          count: slots + SPARE_COUNT,
          // カードの分だけそろえばよい。予備が足りないだけで AI を呼び直さない
          minimum: slots,
          preferred: detail ? [] : preferredForSeed(parent.data.label),
          // 「一番の失敗談」のような汎用のカードでも、何の話の中のお題かが伝わるように（最初のお題も必ず含む）
          context,
          // 掛け合わせのカードなら、持ってきた側のカードが何の話から出た語かも渡す
          mixFrom: parent.data.mixedFromId ? topicContext(started.board, parent.data.mixedFromId, 2) : undefined,
          mode: started.board.mode,
          // トピック図鑑に十分たまっているお題は AI を呼ばずに出す（答えは図鑑に無いので毎回作る）
          recall: !detail,
          detail,
          onTopic: (label) => {
            if (revealed()) reveal(label);
          },
          onStage: (stage) => notes?.stage(stage),
        }).finally(() => notes?.stop());

        const boardNow = () => {
          const snap = currentSnapshot();
          return { latest: snap, latestBoard: snap.boards.find((item) => item.id === boardId) ?? started.board };
        };
        // ボードごと消された・広げたカードが戻された
        const gone = (latestBoard: Board) =>
          !currentSnapshot().boards.some((item) => item.id === boardId) ||
          !started.childIds.some((id) => latestBoard.nodes.some((node) => node.id === id));

        if (!revealed() || gone(boardNow().latestBoard)) {
          pacer.cancel();
          return;
        }

        if (!result.retryLater && STAGGER_REVEAL) {
          // 流れてこなかった分（図鑑・まとめて届いた答え）も、空のカードへ1枚ずつ入れる（ずらさないときは下の fillExpand でまとめて埋める）
          await pacer.drain();
          const { latestBoard } = boardNow();
          const onBoard = new Set(latestBoard.nodes.map((node) => node.data.label));
          const open = latestBoard.nodes.filter((node) => started.childIds.includes(node.id) && node.data.placeholder).length;
          for (const label of result.topics.filter((item) => !onBoard.has(item)).slice(0, open)) reveal(label);
          await pacer.drain();
          if (!revealed() || gone(boardNow().latestBoard)) return;
        } else {
          pacer.cancel();
        }

        const { latest, latestBoard } = boardNow();

        const sameEntry = (entry: HistoryEntry, parentId: string, childIds: string[]) =>
          entry.parentId === parentId &&
          entry.childIds.length === childIds.length &&
          entry.childIds.every((id, index) => id === childIds[index]);

        // AI が答えず図鑑にも足りる語が無い: 定型の候補は並べずに、広げる前（掛け合わせならカードを置く前）へ戻す
        if (result.retryLater) {
          const entry = ops.historyFromChildren(latestBoard, hist.parentId, hist.childIds, hist.edgeIds);
          const undone = ops.undoExpand(latestBoard, entry);
          const restored = clearedHistory ? ops.redoExpand(undone, clearedHistory) : undone;
          persist({ ...latest, boards: latest.boards.map((item) => (item.id === restored.id ? restored : item)) });
          // この広げ方の履歴だけを消す（同じカードを前に広げた分は残す）
          updateHistory(boardId, (history) => {
            const undo = [...history.undo];
            for (let i = undo.length - 1; i >= 0; i -= 1) {
              if (sameEntry(undo[i]!, hist.parentId, hist.childIds)) {
                undo.splice(i, 1);
                break;
              }
            }
            return { ...history, undo };
          });
          toast.warning(result.warning, { duration: 8_000 });
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
        updateHistory(boardId, (history) => {
          const next = [...history.undo];
          for (let i = next.length - 1; i >= 0; i -= 1) {
            const entry = next[i]!;
            if (sameEntry(entry, hist.parentId, hist.childIds)) {
              next[i] = { ...ops.historyFromChildren(filled, hist.parentId, hist.childIds, hist.edgeIds), replaced: entry.replaced };
              break;
            }
          }
          return { ...history, undo: next };
        });
        if (isChatMode(started.board.mode)) recordUsage(parent.data.label, "expands");
        showGenerateNotice(result);
      } finally {
        setBusy(false);
      }
    },
    [persist, updateBoardById],
  );

  /**
   * 「具体的にする」。まだ広げていないカードは答えを 8 つ出す。広げ済みのカード（中心のお題・3×3 の中央）は、
   * 周りの 8 枚を答えで作り直す（その先に広げたカードも消える。「1つ戻る」で元に戻せる）
   */
  const detailNode = useCallback(
    (nodeId: string) => {
      const current = currentSnapshot();
      const board = current.boards.find((item) => item.id === current.activeBoardId);
      const node = board?.nodes.find((item) => item.id === nodeId);
      if (!board || !node || node.data.placeholder || node.data.expanding) return;
      if (!node.data.expanded) {
        void expandNode(nodeId, false, false, true);
        return;
      }
      // マンダラートの中央は写しなので、元のマスから広げ直す（新しい 3×3 ごと作り直す）
      const original = node.data.copiedFromId
        ? board.nodes.find((item) => item.id === node.data.copiedFromId)
        : undefined;
      const target = original ?? node;
      const busyChild = board.nodes.some(
        (item) => item.data.parentId === target.id && (item.data.placeholder || item.data.expanding),
      );
      if (target.data.expanding || busyChild) return;
      toast.message("周りの 8 枚を具体的な内容に作り直します", { description: "元に戻すときは「1つ戻る」" });
      void expandNode(target.id, true, false, true);
    },
    [expandNode],
  );

  /**
   * 掛け合わせ: source を target に重ねた。target の子に「target × source」のカードを置き、
   * 2 つを組み合わせた話題で周りを埋める（キー無しでも「A×B」の定型で埋まる）。
   */
  const combineNodes = useCallback(
    (sourceId: string, targetId: string) => {
      const current = currentSnapshot();
      const board = current.boards.find((item) => item.id === current.activeBoardId);
      if (!board) return;
      const check = canCombine(board, sourceId, targetId);
      if (!check.ok) {
        const mix = existingMix(board, sourceId, targetId);
        if (mix) persist({ ...current, boards: current.boards.map((item) => (item.id === board.id ? ops.focusNode(board, mix.id) : item)) });
        toast.message(check.reason);
        return;
      }
      const added = addMixNode(board, sourceId, targetId, prefsFromSettings(current.settings, false, board.pinnedNodeId));
      if (!added) return;
      persist({ ...current, boards: current.boards.map((item) => (item.id === added.board.id ? added.board : item)) });
      const mix = added.board.nodes.find((node) => node.id === added.mixId);
      toast.message(`「${mix?.data.label ?? ""}」を作りました`, {
        description: "やめるときは「1つ戻る」",
      });
      void expandNode(added.mixId, false, false, false, {
        parentId: targetId,
        childIds: [added.mixId],
        edgeIds: added.edgeIds,
      });
    },
    [expandNode, persist],
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
      updateBoard((item) => ops.addRootNode(item, topic, prefsFromSettings(current.settings, false, item.pinnedNodeId)));
      // 新しいカードが、戻した 3×3 の番号を使うことがある。進む履歴を残すと番号が重なる
      updateHistory(board.id, (history) => ({ ...history, redo: [] }));
      toast.success(`新しいきっかけ: ${topic}`);
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
    expandTokens.current.set(action.parentId, (expandTokens.current.get(action.parentId) ?? 0) + 1);
    for (const id of action.childIds) {
      expandTokens.current.set(id, (expandTokens.current.get(id) ?? 0) + 1);
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
    toast.success("ひとつ戻しました");
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

  const regenerateNode = useCallback(
    async (nodeId: string) => {
      const current = currentSnapshot();
      const board = current.boards.find((item) => item.id === current.activeBoardId);
      const node = board?.nodes.find((item) => item.id === nodeId);
      if (!board || !node || node.data.placeholder || regeneratingRef.current.has(nodeId)) return;
      // 中心のカード（最初の語・広げたカード）を変えると周りの話題とつながらなくなるので作り直さない
      if (node.data.parentId === null || node.data.expanded) {
        toast.message("中心のカードは作り直せません（文を直すことはできます）");
        return;
      }
      const holderId = node.data.parentId;
      const parent = board.nodes.find((item) => item.id === node.data.parentId);
      const seed = parent?.data.label || node.data.label;
      let spare = holderId ? takeSpare(board, holderId) : { board, label: null };
      let recalled: string[] = [];
      const detail = Boolean(node.data.detail);
      if (!spare.label && !detail) {
        // 予備が尽きたら、まずトピック図鑑（自分とみんなの過去の結果・似たお題）から探す。AI は呼ばない。
        // みんなの分は広げたときに取ってきてある。読み込み直した後などで無ければ、次の作り直しに向けて取りに行く
        const mode = boardMode(board);
        void fetchSharedRelated(seed, mode);
        recalled = recallTopicsNow(
          seed,
          [...board.nodes.map((item) => item.data.label), ...rejectedRef.current],
          1 + SPARE_COUNT,
          mode,
        ).topics;
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
            existing: [...board.nodes.map((item) => item.data.label), ...rejectedRef.current],
            count: 1 + SPARE_COUNT,
            minimum: 1,
            preferred: detail ? [] : preferredForSeed(seed),
            context: parent ? topicContext(board, parent.id) : [],
            mode: board.mode,
            detail,
          }),
          new Promise((resolve) => window.setTimeout(resolve, 600)),
        ]);
        if (result.retryLater) {
          // 定型の埋め合わせで今のカードを置き換えない
          toast.warning(result.warning, { duration: 8_000 });
          return;
        }
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

  /**
   * 「ずれている」の印: お題に合わない・間違った生成を図鑑に伝え（マイナスの票）、そのカードを作り直す。
   * 「具体的にする」の答えは、答えを記録したお題（汎用の切り口なら元のお題）の下で減らす
   */
  const rejectNode = useCallback(
    (nodeId: string) => {
      const current = currentSnapshot();
      const board = current.boards.find((item) => item.id === current.activeBoardId);
      const node = board?.nodes.find((item) => item.id === nodeId);
      if (!board || !node || node.data.placeholder || node.data.parentId === null) return;
      const parent = board.nodes.find((item) => item.id === node.data.parentId);
      const seed =
        node.data.detail && parent ? detailRecordSeed(parent.data.label, topicContext(board, parent.id)) : undefined;
      notePick(board, nodeId, "wrong", seed);
      rejectedRef.current.add(node.data.label.trim());
      toast.success("「ずれている」と記録しました。作り直します", { description: "図鑑でもこの語は出にくくなります" });
      void regenerateNode(nodeId);
    },
    [regenerateNode],
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
      toast.success(`「${copy.name}」を複製しました`);
    },
    [persist],
  );

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

  const resetActive = useCallback(() => {
    clearHistory(currentSnapshot().activeBoardId);
    updateBoard((board) => ({
      ...board,
      nodes: [],
      edges: [],
      pinnedNodeId: null,
      focusedNodeId: null,
      updatedAt: Date.now(),
    }));
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
    const incoming = new Map(
      imported.map((board) => [board.id, layoutBoard(board, prefsFromSettings(current.settings, false, board.pinnedNodeId))]),
    );
    const boards = [
      ...current.boards.map((board) => incoming.get(board.id) ?? board),
      ...[...incoming.values()].filter((board) => !current.boards.some((item) => item.id === board.id)),
    ];
    persist({ ...current, boards, activeBoardId: imported[0]!.id });
    for (const board of imported) clearHistory(board.id);
    toast.success(`ボードを ${imported.length} 件読み込みました`);
    return true;
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
    const session = readShareSession();
    let saved = await postShare({ id: shareId ?? session.id, key: session.key }, board, nickname);
    // 書き換えられないリンク（別のタブで作った等）なら、新しいリンクを作り直す
    if (saved === "forbidden") saved = await postShare({ id: null, key: null }, board, nickname);
    if (!saved || saved === "forbidden") {
      toast.error("共有リンクを作れませんでした");
      return;
    }
    const json = saved;
    setShareId(json.id);
    writeShareSession(json);
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

  // 再読み込みしても共有を続ける（下の自動送信でサーバー側が消えていても載せ直す）
  useEffect(() => {
    const saved = readShareSession().id;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage はマウント後にしか読めない
    if (saved) setShareId(saved);
  }, []);

  useEffect(() => {
    if (!shareId || !activeBoard || activeBoard.nodes.length === 0) return;
    const timer = window.setTimeout(() => {
      const current = currentSnapshot();
      const nickname = current.settings.nickname || loadIdentity().nickname;
      void postShare({ id: shareId, key: readShareSession().key }, activeBoard, nickname).then((saved) => {
        if (saved === "forbidden") {
          // 別の端末で作ったリンクなど。黙って送り続けず、作り直してもらう
          writeShareSession(null);
          setShareId(null);
          toast.message("いっしょに見るリンクの更新を止めました", {
            description: "上の共有ボタンから、新しいリンクを作り直してください。",
          });
        } else if (saved) {
          writeShareSession(saved);
        }
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [activeBoard, shareId]);

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
