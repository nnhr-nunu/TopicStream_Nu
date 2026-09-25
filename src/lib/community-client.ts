import { boardUsage, isWellUsed } from "@/lib/community-boards";
import { parseStreamUrl } from "@/lib/stream-url";
import type { Board } from "@/lib/types";

/**
 * みんなのトークテーマ・配信一覧へ知らせる（クライアント）。
 * GitHub Pages のようにサーバーが無いときは、最初の失敗で以後送らない。
 */

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
/** 連携中の配信を「ライブ」のままにしておくための知らせの間隔（サーバーは20分で外す） */
export const STREAM_HEARTBEAT_MS = 8 * 60_000;

let unavailable = false;
const sentBoards = new Map<string, string>();
const sentStreams = new Map<string, number>();

function post(path: string, body: unknown) {
  if (unavailable) return;
  void fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  })
    .then((response) => {
      if (response.status === 404 || response.status === 405) unavailable = true;
    })
    .catch(() => undefined);
}

/** もう一歩広げたボードだけ、使われ具合が変わったときに送る（呼ぶ側で操作が落ち着くまで待つ） */
export function shareBoardUsage(board: Board) {
  if (!isWellUsed(board)) return;
  const usage = JSON.stringify(boardUsage(board));
  if (sentBoards.get(board.id) === usage) return;
  sentBoards.set(board.id, usage);
  post("/api/community", { board });
}

/** 連携した配信URLを一覧に載せる（ライブ表示を保つため、連携中は定期的に呼ぶ） */
export function announceStream(url: string, watchId?: string, now = Date.now()) {
  const ref = parseStreamUrl(url);
  if (!ref) return;
  const key = `${ref.kind}:${ref.kind === "youtube" ? ref.videoId : ref.channel.toLowerCase()}`;
  const prev = sentStreams.get(key);
  if (prev && now - prev < STREAM_HEARTBEAT_MS - 30_000) return;
  sentStreams.set(key, now);
  post("/api/streams", { url, watchId });
}
