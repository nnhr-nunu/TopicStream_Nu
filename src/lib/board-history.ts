import type { HistoryEntry } from "@/lib/types";

/**
 * 「ひとつ戻す／進む」の履歴をボードごとに持つ。
 * ボードを切り替えて戻ってきても・再読み込みしても使えるように、タブの sessionStorage に残す。
 */
export type BoardHistory = { undo: HistoryEntry[]; redo: HistoryEntry[] };

const KEY = "topicstream-nu:history";
const LIMIT = 40;
const EMPTY: BoardHistory = { undo: [], redo: [] };

let histories: Record<string, BoardHistory> = {};
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") histories = parsed as Record<string, BoardHistory>;
  } catch {
    histories = {};
  }
}

function save() {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(histories));
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
