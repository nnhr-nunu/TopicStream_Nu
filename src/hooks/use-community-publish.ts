"use client";

import { useEffect, useRef } from "react";

import { useSettled } from "@/hooks/use-settled";
import { readShareSession } from "@/hooks/use-watch-share";
import { announceStream, shareBoardUsage, STREAM_HEARTBEAT_MS } from "@/lib/community-client";
import { parseStreamUrl, streamerFromUrl } from "@/lib/stream-url";
import type { Board } from "@/lib/types";

/** 操作が落ち着いてからボードを送る（広げている最中に何度も送らない） */
const BOARD_SETTLE_MS = 30_000;

/**
 * ちゃんと使ったボードを「みんなが作った話題マップ」へ、連携した配信URLを「このサービスを利用している配信」へ知らせる。
 * 配信者名は配信URLから取って onStreamer に渡す（入れる欄は無い。配信一覧・いっしょに見る画面の「〇〇 の枠」に出る）
 */
export function useCommunityPublish(
  board: Board | null,
  streamUrl: string,
  watchId?: string,
  onStreamer?: (name: string) => void,
) {
  const onStreamerRef = useRef(onStreamer);
  useEffect(() => {
    onStreamerRef.current = onStreamer;
  });

  useEffect(() => {
    if (!board) return;
    const timer = window.setTimeout(() => shareBoardUsage(board), BOARD_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [board]);

  const inUse = Boolean(board && board.nodes.length > 0);
  // URL を打っている途中（twitch.tv/n → /nu → …）の名前を一覧に載せない
  const settledUrl = useSettled(streamUrl.trim(), 3_000);
  const announceUrl = parseStreamUrl(settledUrl) ? settledUrl : "";
  // Twitch は URL に名前があるので、ボードを使い始める前（サーバーが無い GitHub Pages でも）すぐ入れる
  useEffect(() => {
    const name = streamerFromUrl(announceUrl);
    if (name) onStreamerRef.current?.(name);
  }, [announceUrl]);
  useEffect(() => {
    if (!announceUrl || !inUse) return;
    const announce = () =>
      announceStream(announceUrl, watchId ? { id: watchId, key: readShareSession().key } : undefined, (name) =>
        onStreamerRef.current?.(name),
      );
    announce();
    const timer = window.setInterval(announce, STREAM_HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [inUse, announceUrl, watchId]);
}
