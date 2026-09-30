import { composeSharePost, POST_LIMIT, weightedPostLength } from "@/lib/share-post";
import type { Board } from "@/lib/types";

/**
 * 話した話題のまとめ: NOW にした話題を、時刻つきで 1 本の時系列に残す。
 * ボードごとではなく「いま画面に出ている NOW」を追うので、配信中にボードを切り替えても順番どおりにつながる。
 * 計算は純粋な関数、保存は下の load / save（この端末の localStorage だけ。サーバーには送らない）。
 */
export type TalkEntry = {
  id: string;
  /** どのボードのどのカードを、いつ NOW にしたか（同じ NOW を二重に数えないための印） */
  key: string;
  /** 話し始めた時刻 */
  start: number;
  /** 別の話題へ移した・NOW を外した時刻（話している途中、または途中でブラウザを閉じたものには無い） */
  end?: number;
  label: string;
  /** そのボードの最初のお題 */
  theme: string;
};

/** いま画面に出ている NOW */
export type TalkNow = Pick<TalkEntry, "key" | "label" | "theme">;

/** まとめの 1 行（続けて同じ話題に戻った分は 1 行にまとめてある） */
export type TalkRow = Omit<TalkEntry, "id" | "key"> & { ids: string[] };

export type TalkSession = { id: string; start: number; rows: TalkRow[] };

/** これより短い NOW は数えない（押しまちがい・ルーレットの途中・ボードを切り替えただけ） */
export const MIN_TALK_MS = 10_000;
/** これだけ間が空いたら、別の配信（別のまとまり）として分ける */
export const SESSION_GAP_MS = 3 * 60 * 60_000;
/** 残す期間と件数 */
const KEEP_MS = 30 * 24 * 60 * 60_000;
const KEEP_ENTRIES = 600;

/** ボードの NOW（無ければ null）。広げている途中の空のカードは数えない */
export function currentTalk(board: Board | null | undefined): TalkNow | null {
  if (!board?.pinnedNodeId) return null;
  const node = board.nodes.find((item) => item.id === board.pinnedNodeId);
  const label = node?.data.label.trim();
  if (!node || node.data.placeholder || !label) return null;
  const root = board.nodes.find((item) => item.data.parentId === null && !item.data.placeholder);
  return {
    key: `${board.id}:${node.id}:${board.pinnedAt ?? 0}`,
    label,
    theme: root?.data.label.trim() || board.name,
  };
}

/**
 * 画面の NOW が変わったら履歴を進める: 話していた行を閉じ、新しい NOW の行を足す。
 * 同じ NOW のまま（読み込み直した・別のタブも開いている）なら何もしない。変わらなければ同じ配列を返す
 */
export function syncTalk(log: TalkEntry[], now: TalkNow | null, at: number, newId: string): TalkEntry[] {
  const last = log[log.length - 1];
  const open = last && last.end === undefined ? last : null;
  if (open && now && open.key === now.key) {
    // カードの文を書き直しただけなら、行の文だけ合わせる
    if (open.label === now.label && open.theme === now.theme) return log;
    return [...log.slice(0, -1), { ...open, label: now.label, theme: now.theme }];
  }
  // 何時間も開いたままの行は、途中でブラウザを閉じたもの。いつ話し終えたか分からないので、終わりは書かない
  const closable = open && at - open.start <= SESSION_GAP_MS;
  if (!now && !closable) return log;
  const closed = closable ? [...log.slice(0, -1), { ...open, end: Math.max(open.start, at) }] : log;
  const next = now ? [...closed, { id: newId, key: now.key, start: at, label: now.label, theme: now.theme }] : closed;
  return next.filter((entry) => at - entry.start < KEEP_MS).slice(-KEEP_ENTRIES);
}

/**
 * 履歴を配信ごとのまとまりに分ける（新しい順）。短すぎる NOW は外し、続けて同じ話題に戻った分は 1 行にする
 */
export function talkSessions(log: TalkEntry[]): TalkSession[] {
  const sessions: TalkSession[] = [];
  let rows: TalkRow[] = [];
  let lastSeen = 0;
  const flush = () => {
    if (rows.length > 0) sessions.push({ id: String(rows[0]!.start), start: rows[0]!.start, rows });
    rows = [];
  };
  for (const entry of [...log].sort((a, b) => a.start - b.start)) {
    if (entry.end !== undefined && entry.end - entry.start < MIN_TALK_MS) continue;
    if (rows.length > 0 && entry.start - lastSeen > SESSION_GAP_MS) flush();
    const previous = rows[rows.length - 1];
    if (previous && previous.label === entry.label && previous.theme === entry.theme) {
      previous.ids.push(entry.id);
      previous.end = entry.end;
    } else {
      rows.push({ ids: [entry.id], start: entry.start, end: entry.end, label: entry.label, theme: entry.theme });
    }
    lastSeen = entry.end ?? entry.start;
  }
  flush();
  return sessions.reverse();
}

/** 話した長さ（ミリ秒）。まだ話している最後の行は now まで。長すぎるもの（閉じ忘れ）と、分からないものは null */
export function talkDuration(row: TalkRow, isLast: boolean, now: number): number | null {
  const end = row.end ?? (isLast ? now : undefined);
  if (end === undefined) return null;
  const length = end - row.start;
  return length >= 0 && length <= SESSION_GAP_MS ? length : null;
}

/** 配信の頭からの時間（0:00 / 12:34 / 1:02:03）。YouTube の概要欄がそのままチャプターとして読める形 */
export function formatOffset(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

/** 配信を始めた時刻（origin）から見た行。始める前に終わった話題は外し、始める前から話していた話題は 0:00 にする */
export function rowsFrom(rows: TalkRow[], origin: number): { row: TalkRow; offset: number }[] {
  return rows
    .filter((row, index) => {
      if (row.start >= origin) return true;
      const end = row.end ?? rows[index + 1]?.start;
      return end === undefined || end > origin;
    })
    .map((row) => ({ row, offset: Math.max(0, row.start - origin) }));
}

/** 行に出す名前。ボードをまたいだ配信では、どのお題の中の話題かも付ける */
function rowName(row: TalkRow, withTheme: boolean): string {
  return withTheme && row.theme && row.theme !== row.label ? `${row.label}（${row.theme}）` : row.label;
}

export function usesManyThemes(rows: TalkRow[]): boolean {
  return new Set(rows.map((row) => row.theme)).size > 1;
}

/** 概要欄に貼るタイムスタンプ。YouTube のチャプターは 0:00 から始まる必要があるので、無ければ先頭に足す */
export function talkTimestamps(rows: TalkRow[], origin: number): string {
  const shown = rowsFrom(rows, origin);
  if (shown.length === 0) return "";
  const withTheme = usesManyThemes(shown.map((item) => item.row));
  const lines = shown.map((item) => `${formatOffset(item.offset)} ${rowName(item.row, withTheme)}`);
  if (shown[0]!.offset >= 1000) lines.unshift("0:00 はじまり");
  return lines.join("\n");
}

/** X に投稿する文（ハッシュタグ込み）。サイトのリンクを付けても入る長さにし、入りきらない話題は「ほか」にまとめる */
export function talkPost(rows: TalkRow[], origin: number): string {
  const names = [...new Set(rowsFrom(rows, origin).map((item) => item.row.label))];
  if (names.length === 0) return "";
  const head = "今日の配信で話したこと💬";
  let body = head;
  for (const [index, name] of names.entries()) {
    const rest = index < names.length - 1;
    const candidate = `${body}\n・${name}`;
    // まだ残りがあるなら、「ほか」を足しても入る長さまで
    const fits = weightedPostLength(composeSharePost(rest ? `${candidate}\n…ほか` : candidate), true) <= POST_LIMIT;
    if (!fits) return composeSharePost(body === head ? candidate : `${body}\n…ほか`);
    body = candidate;
  }
  return composeSharePost(body);
}

/**
 * 「配信を始めた時刻」（HH:MM）を、そのまとまりの日付に当てはめた時刻にする。
 * 日付をまたぐ配信でも、まとまりの最初の話題にいちばん近い日を選ぶ
 */
export function originFromClock(sessionStart: number, clock: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!match) return sessionStart;
  const date = new Date(sessionStart);
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  const day = 24 * 60 * 60_000;
  let origin = date.getTime();
  if (origin - sessionStart > day / 2) origin -= day;
  else if (sessionStart - origin > day / 2) origin += day;
  return origin;
}

export function clockOf(time: number): string {
  const date = new Date(time);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// ---- 保存（この端末だけ） ----

const TALK_LOG_KEY = "topicstream-nu:talk-log";
const NO_LOG: TalkEntry[] = [];
const listeners = new Set<() => void>();
let cache: TalkEntry[] = NO_LOG;
let cacheRaw = "";

function asEntry(value: unknown): TalkEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<TalkEntry>;
  if (typeof entry.id !== "string" || typeof entry.key !== "string" || typeof entry.label !== "string") return null;
  if (typeof entry.start !== "number" || !Number.isFinite(entry.start)) return null;
  return {
    id: entry.id,
    key: entry.key,
    start: entry.start,
    end: typeof entry.end === "number" && Number.isFinite(entry.end) ? entry.end : undefined,
    label: entry.label.slice(0, 160),
    theme: typeof entry.theme === "string" ? entry.theme.slice(0, 160) : "",
  };
}

export function subscribeTalkLog(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function loadTalkLog(): TalkEntry[] {
  if (typeof window === "undefined") return cache;
  try {
    const raw = window.localStorage.getItem(TALK_LOG_KEY) ?? "[]";
    if (raw === cacheRaw) return cache;
    const parsed = JSON.parse(raw) as unknown;
    cacheRaw = raw;
    cache = Array.isArray(parsed) ? parsed.map(asEntry).filter((entry): entry is TalkEntry => entry !== null) : NO_LOG;
  } catch {
    /* 読めないときは、手元にある分のまま */
  }
  return cache;
}

export function getServerTalkLog(): TalkEntry[] {
  return NO_LOG;
}

function saveTalkLog(next: TalkEntry[]) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(next);
  cache = next;
  cacheRaw = raw;
  try {
    window.localStorage.setItem(TALK_LOG_KEY, raw);
  } catch {
    /* 容量いっぱい・プライベートモードでは、開いている間だけ覚えておく */
  }
  for (const listener of listeners) listener();
}

/** 画面の NOW が変わったときに呼ぶ */
export function noteTalk(now: TalkNow | null) {
  const log = loadTalkLog();
  const id = `talk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const next = syncTalk(log, now, Date.now(), id);
  if (next !== log) saveTalkLog(next);
}

/** まとめから 1 行を消す（押しまちがいや、配信していないときの NOW） */
export function removeTalkRow(ids: string[]) {
  const log = loadTalkLog();
  const next = log.filter((entry) => !ids.includes(entry.id));
  if (next.length !== log.length) saveTalkLog(next);
}
