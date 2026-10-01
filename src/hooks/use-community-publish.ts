"use client";

import { useEffect, useState } from "react";

import { useSettled } from "@/hooks/use-settled";
import { readShareSession } from "@/hooks/use-watch-share";
import { announceStream, shareBoardUsage, STREAM_HEARTBEAT_MS } from "@/lib/community-client";
import { parseStreamUrl, streamerFromUrl } from "@/lib/stream-url";
import type { Board } from "@/lib/types";

/** 操作が落ち着いてからボードを送る（広げている最中に何度も送らない） */
const BOARD_SETTLE_MS = 30_000;

/**
 * ちゃんと使ったボードを「みんなが作った話題マップ」へ、連携した配信URLを「このサービスを利用している配信」へ知らせる。
 * customStreamer は手で直した配信者名（一覧にもその名前で載る）。
 * 返すのは配信 URL から分かる配信者名（Twitch はチャンネル名、YouTube はサーバーが調べたチャンネル名。分かるまでは空）
 */
export function useCommunityPublish(board: Board | null, streamUrl: string, watchId?: string, customStreamer = "") {
  useEffect(() => {
    if (!board) return;
    const timer = window.setTimeout(() => shareBoardUsage(board), BOARD_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [board]);

  const inUse = Boolean(board && board.nodes.length > 0);
  // URL を打っている途中（twitch.tv/n → /nu → …）の名前を一覧に載せない
  const settledUrl = useSettled(streamUrl.trim(), 3_000);
  const announceUrl = parseStreamUrl(settledUrl) ? settledUrl : "";
  /** サーバーが調べた配信サイトでの名前（どの URL のものか） */
  const [served, setServed] = useState<{ url: string; name: string } | null>(null);
  useEffect(() => {
    if (!announceUrl || !inUse) return;
    const announce = () =>
      announceStream(announceUrl, {
        watch: watchId ? { id: watchId, key: readShareSession().key } : undefined,
        streamer: customStreamer || undefined,
        onAuthor: (name) => setServed({ url: announceUrl, name }),
      });
    announce();
    const timer = window.setInterval(announce, STREAM_HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [inUse, announceUrl, watchId, customStreamer]);

  // Twitch は URL に名前があるので、ボードを使い始める前（サーバーが無い GitHub Pages でも）すぐ分かる
  return streamerFromUrl(announceUrl) || (served?.url === announceUrl ? served.name : "");
}
