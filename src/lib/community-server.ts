import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CatalogBoard } from "@/lib/catalog-data";
import { searchCatalog } from "@/lib/catalog-data";
import { rankCommunityBoards, toCommunityBoard, type CommunityBoard } from "@/lib/community-boards";
import { isShareOwner } from "@/lib/live-store";
import { isPublicSafe } from "@/lib/public-text";
import { redisCommand, redisConfig } from "@/lib/redis";
import { asBoard, withoutMemos } from "@/lib/storage";
import { canonicalStreamUrl, pickStreamerName, type PublicStream } from "@/lib/stream-directory";
import { parseStreamUrl } from "@/lib/stream-url";

/**
 * みんなが作った話題マップと配信一覧の保存先（サーバー専用）。
 * Redis があればそこへ、無ければインスタンスのメモリと一時ファイル（開発用。Vercel では再起動で消える）。
 */

const BOARD_LIMIT = 150;
const STREAM_LIMIT = 60;
/** この時間内に連携の知らせが来ていれば「ライブ」と出す */
const LIVE_WINDOW_MS = 20 * 60_000;
/** 一覧の読み直し間隔（Redis のコマンド数を抑える） */
const CACHE_TTL_MS = 60_000;

const KEY_BOARDS = "tsc:boards";
const KEY_FAVORITES = "tsc:bfav";
const KEY_STREAMS = "tsc:streams";

type State = {
  boards: Record<string, CommunityBoard>;
  favorites: Record<string, number>;
  streams: Record<string, PublicStream>;
};

const FILE = join(tmpdir(), "topicstream-nu-community.json");
let memory: State | null = null;

function loadMemory(): State {
  if (memory) return memory;
  try {
    memory = JSON.parse(readFileSync(FILE, "utf8")) as State;
  } catch {
    memory = { boards: {}, favorites: {}, streams: {} };
  }
  memory.boards ??= {};
  memory.favorites ??= {};
  memory.streams ??= {};
  return memory;
}

function persistMemory() {
  try {
    mkdirSync(tmpdir(), { recursive: true });
    writeFileSync(FILE, JSON.stringify(memory));
  } catch {
    /* 読み取り専用の環境ではメモリだけ使う */
  }
}

function parseHash<T>(flat: unknown): Record<string, T> {
  const out: Record<string, T> = {};
  if (!Array.isArray(flat)) return out;
  for (let index = 0; index + 1 < flat.length; index += 2) {
    try {
      out[String(flat[index])] = JSON.parse(String(flat[index + 1])) as T;
    } catch {
      /* 壊れた行は読み飛ばす */
    }
  }
  return out;
}

/** 古いものから消して、上限の数に収める */
function oldest<T extends { updatedAt: number }>(items: Record<string, T>, limit: number): string[] {
  const entries = Object.entries(items);
  if (entries.length <= limit) return [];
  return entries
    .sort((a, b) => a[1].updatedAt - b[1].updatedAt)
    .slice(0, entries.length - limit)
    .map(([key]) => key);
}

let cache: { at: number; state: State } | null = null;

async function loadState(): Promise<State> {
  const config = redisConfig();
  if (!config) return loadMemory();
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.state;
  try {
    const [boards, favorites, streams] = await Promise.all([
      redisCommand(config, ["HGETALL", KEY_BOARDS]),
      redisCommand(config, ["HGETALL", KEY_FAVORITES]),
      redisCommand(config, ["HGETALL", KEY_STREAMS]),
    ]);
    const state: State = {
      boards: parseHash<CommunityBoard>(boards),
      favorites: parseHash<number>(favorites),
      streams: parseHash<PublicStream>(streams),
    };
    cache = { at: Date.now(), state };
    return state;
  } catch {
    return cache?.state ?? { boards: {}, favorites: {}, streams: {} };
  }
}

/** 端末のボード ID をそのまま見せない（見えると上書きできてしまう） */
function publicBoardId(boardId: string): string {
  return `cb_${createHash("sha256").update(`community:${boardId}`).digest("hex").slice(0, 16)}`;
}

export async function saveCommunityBoard(raw: unknown): Promise<boolean> {
  const parsed = asBoard(raw);
  if (!parsed) return false;
  const board = withoutMemos(parsed);
  const entry = toCommunityBoard(board, publicBoardId(board.id));
  if (!entry) return false;
  const config = redisConfig();
  if (!config) {
    const state = loadMemory();
    state.boards[entry.id] = entry;
    for (const key of oldest(state.boards, BOARD_LIMIT)) delete state.boards[key];
    persistMemory();
    return true;
  }
  try {
    await redisCommand(config, ["HSET", KEY_BOARDS, entry.id, JSON.stringify(entry)]);
    if (cache) cache.state.boards[entry.id] = entry;
    const count = Number(await redisCommand(config, ["HLEN", KEY_BOARDS]));
    if (count > BOARD_LIMIT) {
      const all = parseHash<CommunityBoard>(await redisCommand(config, ["HGETALL", KEY_BOARDS]));
      const drop = oldest(all, BOARD_LIMIT);
      if (drop.length > 0) await redisCommand(config, ["HDEL", KEY_BOARDS, ...drop]);
    }
    return true;
  } catch {
    return false;
  }
}

export async function listCommunityCatalog(query = ""): Promise<CatalogBoard[]> {
  const state = await loadState();
  return searchCatalog(rankCommunityBoards(Object.values(state.boards), state.favorites), query);
}

/** ♡（delta が -1 なら外す。0 より下げない）。載っていないボードなら null */
export async function bumpCommunityFavorite(id: string, delta: 1 | -1 = 1): Promise<number | null> {
  const state = await loadState();
  if (!Object.hasOwn(state.boards, id)) return null;
  const config = redisConfig();
  if (!config) {
    state.favorites[id] = Math.max(0, (state.favorites[id] ?? 0) + delta);
    persistMemory();
    return state.favorites[id]!;
  }
  try {
    let count = Number(await redisCommand(config, ["HINCRBY", KEY_FAVORITES, id, delta]));
    if (count < 0) {
      await redisCommand(config, ["HSET", KEY_FAVORITES, id, 0]);
      count = 0;
    }
    state.favorites[id] = count;
    return count;
  } catch {
    return null;
  }
}

/** YouTube の題名とチャンネル名（キー不要の oEmbed）。動画が無ければ null */
async function youtubeInfo(url: string): Promise<{ title: string; author: string } | null> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(4_000), cache: "no-store" },
    );
    if (!response.ok) return null;
    const json = (await response.json()) as { title?: unknown; author_name?: unknown };
    const title = typeof json.title === "string" ? json.title.trim() : "";
    const author = typeof json.author_name === "string" ? json.author_name.trim() : "";
    return title ? { title, author } : null;
  } catch {
    return null;
  }
}

/**
 * 連携した配信を一覧に載せる。同じ枠はまとめて、最後に知らせが来た時刻を更新する。
 * streamer は配信者が手で直した名前（無ければ配信サイトでの名前で載せる）
 */
export async function saveStream(input: {
  url: unknown;
  watchId?: unknown;
  watchKey?: unknown;
  streamer?: unknown;
}): Promise<PublicStream | null> {
  const ref = typeof input.url === "string" ? parseStreamUrl(input.url.trim()) : null;
  if (!ref) return null;
  const url = canonicalStreamUrl(ref);
  const state = await loadState();
  const prev = state.streams[url];
  let title = prev?.title ?? "";
  // 配信サイトでの名前。前からある枠（author を持つ前のもの）は streamer がそのまま配信サイトでの名前
  let author = prev?.author ?? prev?.streamer ?? "";
  if (ref.kind === "youtube" && !prev) {
    const info = await youtubeInfo(url);
    if (!info) return null;
    title = info.title;
    author = info.author;
  }
  if (ref.kind === "twitch") {
    title ||= "Twitch の配信";
    author = ref.channel;
  }
  // 題名・配信者名も公開する文なので、ほかの公開の場所と同じフィルタを通す（手で直した名前は pickStreamerName の中で通す）
  if (!isPublicSafe(title) || !isPublicSafe(author)) return null;
  const streamer = pickStreamerName(author, input.streamer);
  // いっしょに見るリンクを付けられるのは、そのリンクの持ち主だけ（他人の配信の枠に別のボードをつなげない）
  const ownsWatch =
    typeof input.watchId === "string" && typeof input.watchKey === "string" && (await isShareOwner(input.watchId, input.watchKey));
  const watchId = ownsWatch ? (input.watchId as string) : prev?.watchId;
  const stream: PublicStream = {
    id: prev?.id ?? `stream_${createHash("sha256").update(url).digest("hex").slice(0, 12)}`,
    title: title.slice(0, 100),
    streamer: streamer.slice(0, 40),
    author: author.slice(0, 40),
    platform: ref.kind,
    url,
    live: true,
    watchId,
    updatedAt: Date.now(),
  };
  const config = redisConfig();
  if (!config) {
    state.streams[url] = stream;
    for (const key of oldest(state.streams, STREAM_LIMIT)) delete state.streams[key];
    persistMemory();
    return stream;
  }
  try {
    await redisCommand(config, ["HSET", KEY_STREAMS, url, JSON.stringify(stream)]);
    state.streams[url] = stream;
    const drop = oldest(state.streams, STREAM_LIMIT);
    if (drop.length > 0) await redisCommand(config, ["HDEL", KEY_STREAMS, ...drop]);
    return stream;
  } catch {
    return null;
  }
}

export async function listStreams(now = Date.now()): Promise<PublicStream[]> {
  const state = await loadState();
  return Object.values(state.streams).map((stream) => ({ ...stream, live: now - stream.updatedAt < LIVE_WINDOW_MS }));
}
