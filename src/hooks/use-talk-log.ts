"use client";

import { useEffect, useRef } from "react";

import { currentTalk, noteTalk } from "@/lib/talk-log";
import type { Board } from "@/lib/types";

/** 開いた直後でも「いま始めた」と数えるのは、これより新しく触ったボードだけ（図鑑などで作ってすぐ開いたボード） */
const FRESH_MS = 2 * 60_000;

/**
 * 画面に出ているボードの NOW を追って、話した話題の履歴（talk-log.ts）に残す。
 * 表示中のボードを渡す（読み込みが終わるまでは null）。ボードを切り替えたときも、そのボードの NOW へ移ったものとして数える
 */
export function useTalkLog(board: Board | null) {
  /** 最後に見た NOW（まだ一度も見ていなければ null） */
  const seen = useRef<string | null>(null);

  useEffect(() => {
    if (!board) return;
    const now = currentTalk(board);
    const signature = now ? `${now.key}|${now.label}|${now.theme}` : "";
    const opening = seen.current === null;
    if (seen.current === signature) return;
    seen.current = signature;
    // ページを開いたときに前から付いていた NOW は、いま話し始めたものとしては数えない
    if (opening && Date.now() - board.updatedAt > FRESH_MS) return;
    noteTalk(now);
  }, [board]);
}
