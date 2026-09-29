import { STORAGE_KEY } from "@/lib/constants";
import { defaultSnapshot, loadSnapshot, parseSnapshot, saveSnapshot } from "@/lib/storage";
import type { AppSnapshot } from "@/lib/types";
import { toast } from "sonner";

const SERVER_SNAPSHOT = defaultSnapshot();
let snapshot: AppSnapshot = SERVER_SNAPSHOT;
let hydrated = false;
const listeners = new Set<() => void>();
let storageFullNoticed = false;

function emit() {
  for (const listener of listeners) listener();
}

function hydrateIfNeeded() {
  if (hydrated || typeof window === "undefined") return;
  snapshot = loadSnapshot();
  hydrated = true;
}

export function subscribeBoardStore(listener: () => void) {
  hydrateIfNeeded();
  listeners.add(listener);
  // 別のタブの変更を読む。同じ関数は 1 回しか登録されないので、最後の購読者が抜けたときだけ外す
  // （1 人抜けるたびに外すと、残った画面が別タブの変更を知らないまま古い内容で上書きしてしまう）
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function onStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  try {
    snapshot = parseSnapshot(JSON.parse(event.newValue));
    hydrated = true;
    emit();
  } catch {
    /* ignore */
  }
}

export function getBoardSnapshot() {
  hydrateIfNeeded();
  return snapshot;
}

export function getServerBoardSnapshot() {
  return SERVER_SNAPSHOT;
}

export function writeBoardSnapshot(next: AppSnapshot) {
  snapshot = next;
  hydrated = true;
  try {
    saveSnapshot(next);
  } catch {
    // ブラウザの保存容量がいっぱい。盤面は開いている間は使えるので、気づけるように一度だけ知らせる
    if (!storageFullNoticed) {
      storageFullNoticed = true;
      toast.warning("ボードを保存できませんでした", {
        description: "ブラウザの保存容量がいっぱいです。使わないボードを削除するか、「書き出す」で控えを取ってください。",
        duration: 10_000,
      });
    }
  }
  emit();
}

// 図鑑などの別ページでボードを作ってから "/" へ戻るときだけ、ホームではなくマップを直接開く。
// 普通にサイトへ来たときはホームから始める。
let openActiveBoardRequested = false;

export function requestOpenActiveBoard() {
  openActiveBoardRequested = true;
}

export function isOpenActiveBoardRequested() {
  return openActiveBoardRequested;
}

export function clearOpenActiveBoardRequest() {
  openActiveBoardRequested = false;
}
