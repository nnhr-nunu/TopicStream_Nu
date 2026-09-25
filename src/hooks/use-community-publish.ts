"use client";

import { useEffect } from "react";

import { announceStream, shareBoardUsage, STREAM_HEARTBEAT_MS } from "@/lib/community-client";
import type { Board } from "@/lib/types";

/** 操作が落ち着いてからボードを送る（広げている最中に何度も送らない） */
const BOARD_SETTLE_MS = 30_000;

/**
 * ちゃんと使ったボードを「みんなのトークテーマ」へ、連携した配信URLを「このサービスを利用している配信」へ知らせる。
 */
export function useCommunityPublish(board: Board | null, streamUrl: string, watchId?: string) {
  useEffect(() => {
    if (!board) return;
    const timer = window.setTimeout(() => shareBoardUsage(board), BOARD_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [board]);

  const inUse = Boolean(board && board.nodes.length > 0);
  useEffect(() => {
    if (!streamUrl.trim() || !inUse) return;
    announceStream(streamUrl, watchId);
    const timer = window.setInterval(() => announceStream(streamUrl, watchId), STREAM_HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [inUse, streamUrl, watchId]);
}
