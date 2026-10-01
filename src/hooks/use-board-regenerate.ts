"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";

import * as ops from "@/lib/board-ops";
import { currentSnapshot, existingForPrompt } from "@/lib/board-controller-helpers";
import { aiKeyToastAction } from "@/lib/settings-open";
import { addSpares, SPARE_COUNT, takeSpare } from "@/lib/board-spares";
import { detailRecordSeed } from "@/lib/detail-modes";
import { showGenerateNotice } from "@/lib/expand-notices";
import { generateRelatedTopics } from "@/lib/gemini";
import { fetchSharedRelated, notePick, recallTopicsNow } from "@/lib/knowledge-client";
import { prefsFromSettings } from "@/lib/layout";
import { boardMode } from "@/lib/modes";
import { preferredForSeed } from "@/lib/popularity";
import { topicContext } from "@/lib/topic-context";
import type { Board } from "@/lib/types";

/** 予備が尽きて AI に作り直しを頼んだあと、次に頼めるまでの間隔（無料枠を連打で使い切らないため） */
export const REGEN_COOLDOWN_MS = 15_000;

type RegenerateDeps = {
  updateBoardById: (boardId: string, mutator: (board: Board) => Board) => void;
  /** 「ずれている」の印を付けた語。盤面から消えても、このあと AI・図鑑から出し直さない */
  rejectedRef: RefObject<Set<string>>;
};

/** 1 枚のカードの作り直しと「ずれている」の印（予備 → 図鑑 → AI の順に探す） */
export function useBoardRegenerate({ updateBoardById, rejectedRef }: RegenerateDeps) {
  const regeneratingRef = useRef(new Set<string>());
  const [regeneratingIds, setRegeneratingIds] = useState<string[]>([]);
  const [regenReadyAt, setRegenReadyAt] = useState(0);

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
      regeneratingRef.current.add(nodeId);
      setRegeneratingIds([...regeneratingRef.current]);
      const prefs = () => {
        const snap = currentSnapshot();
        const target = snap.boards.find((item) => item.id === board.id);
        return prefsFromSettings(snap.settings, false, target?.pinnedNodeId ?? null);
      };
      /** 文を差し替える。文が変わるので「いま話している」は外す（作り直せなかったときは NOW のまま残す） */
      const relabel = (item: Board, label: string) => {
        const unpinned = item.pinnedNodeId === nodeId ? ops.pinNode(item, null, prefs()) : item;
        return ops.setLabel(unpinned, nodeId, label, prefs());
      };
      try {
        if (recalled.length > 0) {
          // 図鑑から出す。残りは次の作り直し用の予備にする
          const [label, ...rest] = recalled;
          await new Promise((resolve) => window.setTimeout(resolve, 350));
          updateBoardById(board.id, (item) => {
            const relabeled = relabel(item, label!);
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
            return relabel(taken.board, taken.label ?? label);
          });
          return;
        }
        setRegenReadyAt(Date.now() + REGEN_COOLDOWN_MS);
        // 1語だけのために呼ぶのはもったいないので、次の分の予備もまとめてもらう
        const [result] = await Promise.all([
          generateRelatedTopics({
            seed,
            existing: [...existingForPrompt(board, nodeId), ...rejectedRef.current],
            apiKey: currentSnapshot().settings.geminiApiKey,
            model: currentSnapshot().settings.geminiModel,
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
          toast.warning(result.warning, {
            duration: 8_000,
            action: aiKeyToastAction(result.noticeKind, Boolean(currentSnapshot().settings.geminiApiKey)),
          });
          return;
        }
        const [nextLabel, ...rest] = result.topics;
        if (nextLabel) {
          updateBoardById(board.id, (item) => {
            const relabeled = relabel(item, nextLabel);
            return holderId ? addSpares(relabeled, holderId, rest) : relabeled;
          });
        }
        showGenerateNotice(result);
      } finally {
        regeneratingRef.current.delete(nodeId);
        setRegeneratingIds([...regeneratingRef.current]);
      }
    },
    [regenReadyAt, updateBoardById, rejectedRef],
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
    [regenerateNode, rejectedRef],
  );

  return { regenerateNode, rejectNode, regeneratingIds, regenReadyAt };
}
