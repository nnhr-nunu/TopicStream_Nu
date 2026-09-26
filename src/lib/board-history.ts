import type { HistoryEntry } from "@/lib/types";

/**
 * 「ひとつ戻す／進む」の履歴をボードごとに持つ。
 * ボードを切り替えても・ブラウザを閉じて開き直しても使えるように、localStorage に残す。
 */
export type BoardHistory = { undo: HistoryEntry[]; redo: HistoryEntry[] };

const KEY = "topicstream-nu:history";
const LIMIT = 40;
/** ボード本体と同じ localStorage を使うので、履歴がボードの保存場所を食わないよう大きさを抑える（文字数） */
const MAX_CHARS = 1_000_000;
const EMPTY: BoardHistory = { undo: [], redo: [] };

let histories: Record<string, BoardHistory> = {};
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") histories = parsed as Record<string, BoardHistory>;
  } catch {
    histories = {};
  }
}

/** 大きすぎるときは、どのボードも古い方から半分ずつ捨てていく */
export function fitHistories(all: Record<string, BoardHistory>, maxChars = MAX_CHARS) {
  let next = all;
  let text = JSON.stringify(next);
  while (text.length > maxChars && Object.values(next).some((item) => item.undo.length + item.redo.length > 0)) {
    next = Object.fromEntries(
      Object.entries(next).map(([id, item]) => [
        id,
        { undo: item.undo.slice(Math.ceil(item.undo.length / 2)), redo: item.redo.slice(Math.ceil(item.redo.length / 2)) },
      ]),
    );
    text = JSON.stringify(next);
  }
  return { histories: next, text };
}

function save() {
  const fitted = fitHistories(histories);
  histories = fitted.histories;
  try {
    window.localStorage.setItem(KEY, fitted.text);
  } catch {
    // 容量オーバーなどで残せなくても、このページを開いている間は使える
  }
}

export function subscribeHistory(listener: () => void) {
  load();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getHistories() {
  load();
  return histories;
}

const SERVER_HISTORIES: Record<string, BoardHistory> = {};
export function getServerHistories() {
  return SERVER_HISTORIES;
}

export function historyOf(boardId: string | null | undefined): BoardHistory {
  if (!boardId) return EMPTY;
  return getHistories()[boardId] ?? EMPTY;
}

export function updateHistory(boardId: string, mutator: (history: BoardHistory) => BoardHistory) {
  load();
  const next = mutator(histories[boardId] ?? EMPTY);
  histories = { ...histories, [boardId]: { undo: next.undo.slice(-LIMIT), redo: next.redo.slice(-LIMIT) } };
  save();
  for (const listener of listeners) listener();
}

export function clearHistory(boardId: string) {
  load();
  if (!histories[boardId]) return;
  histories = Object.fromEntries(Object.entries(histories).filter(([id]) => id !== boardId));
  save();
  for (const listener of listeners) listener();
}

export function clearAllHistory() {
  load();
  histories = {};
  save();
  for (const listener of listeners) listener();
}
