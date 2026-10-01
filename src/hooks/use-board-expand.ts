"use client";

import { useCallback, useState, type RefObject } from "react";
import { toast } from "sonner";

import * as ops from "@/lib/board-ops";
import { addMixNode, canCombine, existingMix } from "@/lib/board-combine";
import { currentSnapshot, existingForPrompt, expandKey, pushUndo, sameEntry } from "@/lib/board-controller-helpers";
import { aiKeyToastAction } from "@/lib/settings-open";
import { updateHistory } from "@/lib/board-history";
import { addSpares, SPARE_COUNT, spareHolderId } from "@/lib/board-spares";
import { showAnchorNotice, showGenerateNotice, startWaitNotes } from "@/lib/expand-notices";
import { createPacer, REVEAL_GAP_MS, STAGGER_REVEAL } from "@/lib/expand-wait";
import { generateRelatedTopics } from "@/lib/gemini";
import { notePick } from "@/lib/knowledge-client";
import { prefsFromSettings } from "@/lib/layout";
import { isChatMode } from "@/lib/modes";
import { preferredForSeed } from "@/lib/popularity";
import { topicContext } from "@/lib/topic-context";
import type { AppSnapshot, Board, HistoryEntry } from "@/lib/types";
import { recordUsage } from "@/lib/usage";

type ExpandDeps = {
  persist: (next: AppSnapshot) => void;
  updateBoardById: (boardId: string, mutator: (board: Board) => Board) => void;
  /** カードごとの広げ方の世代。戻す・広げ直すと進めて、遅れて届いた結果を捨てる（戻す側からも進める） */
  expandTokensRef: RefObject<Map<string, number>>;
  /** 「ずれている」の印を付けた語。広げるときも、AI・図鑑から出し直さない */
  rejectedRef: RefObject<Set<string>>;
};

/** AI でカードを広げる（ふつうの広げ方・「具体的にする」・掛け合わせ）。広げている数を busy で返す */
export function useBoardExpand({ persist, updateBoardById, expandTokensRef, rejectedRef }: ExpandDeps) {
  // 同時に広げている数（最初に終わった方で「待ち」が解けないよう、数で持つ）
  const [busyCount, setBusyCount] = useState(0);
  const busy = busyCount > 0;

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

      // 同じカードの ID が別のボードにもある（みんなのマップを 2 回写した等）ので、ボードごとに数える
      const tokenKey = expandKey(started.board.id, nodeId);
      const token = (expandTokensRef.current.get(tokenKey) ?? 0) + 1;
      expandTokensRef.current.set(tokenKey, token);
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
      const boardId = started.board.id;
      /** 広げる前（掛け合わせならカードを置く前）へ戻し、この広げ方の履歴だけを消す（同じカードを前に広げた分は残す） */
      const rollback = () => {
        const latest = currentSnapshot();
        const latestBoard = latest.boards.find((item) => item.id === boardId);
        if (!latestBoard) return;
        const entry = ops.historyFromChildren(latestBoard, hist.parentId, hist.childIds, hist.edgeIds);
        const undone = ops.undoExpand(latestBoard, entry);
        const restored = clearedHistory ? ops.redoExpand(undone, clearedHistory) : undone;
        persist({ ...latest, boards: latest.boards.map((item) => (item.id === restored.id ? restored : item)) });
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
      };
      setBusyCount((count) => count + 1);
      try {
        const existingLabels = [...existingForPrompt(started.board, nodeId), ...rejectedRef.current];
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
        const revealed = () => expandTokensRef.current.get(tokenKey) === token;
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
          // 設定に自分の AI キーがあれば、みんなの枠ではなくそのキーで頼む
          apiKey: current.settings.geminiApiKey,
          model: current.settings.geminiModel,
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

        // AI が答えず図鑑にも足りる語が無い: 定型の候補は並べずに、広げる前へ戻す
        if (result.retryLater) {
          rollback();
          toast.warning(result.warning, {
            duration: 8_000,
            action: aiKeyToastAction(result.noticeKind, Boolean(currentSnapshot().settings.geminiApiKey)),
          });
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
      } catch (error) {
        // 途中で投げたら、空のカード（…）と「広げている途中」の印を残さない（残すとそのカードを広げ直せない）
        console.error(error);
        if (expandTokensRef.current.get(tokenKey) === token) rollback();
        toast.error("話題を広げられませんでした。もう一度お試しください");
      } finally {
        setBusyCount((count) => Math.max(0, count - 1));
      }
    },
    [persist, updateBoardById, expandTokensRef, rejectedRef],
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
      toast.message("周りの 8 枚を具体的な内容に作り直します", { description: "取り消すときは「1つ戻る」" });
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
        description: "取り消すときは「1つ戻る」",
      });
      void expandNode(added.mixId, false, false, false, {
        parentId: targetId,
        childIds: [added.mixId],
        edgeIds: added.edgeIds,
      });
    },
    [expandNode, persist],
  );

  return { busy, expandNode, detailNode, combineNodes };
}
