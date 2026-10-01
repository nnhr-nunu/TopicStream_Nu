import { boardUsage, isWellUsed } from "@/lib/community-boards";
import { isChatMode } from "@/lib/modes";
import { withoutMemos } from "@/lib/storage";
import { parseStreamUrl } from "@/lib/stream-url";
import type { Board } from "@/lib/types";

/**
 * みんなが作った話題マップ・配信一覧へ知らせる（クライアント）。
 * GitHub Pages のようにサーバーが無いときは、最初の失敗で以後送らない。
 */

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
/** 連携中の配信を「ライブ」のままにしておくための知らせの間隔（サーバーは20分で外す） */
export const STREAM_HEARTBEAT_MS = 8 * 60_000;

let unavailable = false;
const sentBoards = new Map<string, string>();
const sentStreams = new Map<string, number>();

/** 返事の JSON を返す（失敗・サーバーが無いときは null） */
function post(path: string, body: unknown): Promise<unknown> {
  if (unavailable) return Promise.resolve(null);
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  })
    .then((response) => {
      if (response.status === 404 || response.status === 405) unavailable = true;
      return response.ok ? response.json().catch(() => null) : null;
    })
    .catch(() => null);
}

/** もう一歩広げたボードだけ、使われ具合が変わったときに送る（呼ぶ側で操作が落ち着くまで待つ） */
export function shareBoardUsage(board: Board) {
  // 雑談以外のボード（お悩み相談など）は、みんなが作った話題マップにも載せない
  if (!isChatMode(board.mode) || !isWellUsed(board)) return;
  const usage = JSON.stringify(boardUsage(board));
  if (sentBoards.get(board.id) === usage) return;
  sentBoards.set(board.id, usage);
  // 付箋は自分用。サーバーでも外すが、そもそも送らない
  void post("/api/community", { board: withoutMemos(board) });
}

/**
 * 連携した配信URLを一覧に載せる（ライブ表示を保つため、連携中は定期的に呼ぶ）。
 * watch.key はいっしょに見るリンクの持ち主の鍵。持ち主だけが一覧の枠に自分のリンクを付けられる。
 * streamer は手で直した配信者名。onAuthor にはサーバーが調べた配信サイトでの名前（YouTube はチャンネル名）を渡す
 */
export function announceStream(
  url: string,
  opts: { watch?: { id: string; key: string | null }; streamer?: string; onAuthor?: (name: string) => void } = {},
  now = Date.now(),
) {
  const { watch, streamer, onAuthor } = opts;
  const ref = parseStreamUrl(url);
  if (!ref) return;
  // いっしょに見るリンクを後から作った・名前を直したときは、間引かずにすぐ載せ直す（リンクと名前もキーに入れる）
  const key = `${ref.kind}:${ref.kind === "youtube" ? ref.videoId : ref.channel.toLowerCase()}:${watch?.id ?? ""}:${streamer ?? ""}`;
  const prev = sentStreams.get(key);
  if (prev && now - prev < STREAM_HEARTBEAT_MS - 30_000) return;
  sentStreams.set(key, now);
  void post("/api/streams", { url, watchId: watch?.id, watchKey: watch?.key ?? undefined, streamer }).then((json) => {
    const author = (json as { stream?: { author?: unknown } } | null)?.stream?.author;
    if (typeof author === "string" && author.trim()) onAuthor?.(author.trim());
  });
}
