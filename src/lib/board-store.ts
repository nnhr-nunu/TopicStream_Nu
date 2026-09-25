import { STORAGE_KEY } from "@/lib/constants";
import { defaultSnapshot, loadSnapshot, parseSnapshot, saveSnapshot } from "@/lib/storage";
import type { AppSnapshot } from "@/lib/types";

const SERVER_SNAPSHOT = defaultSnapshot();
let snapshot: AppSnapshot = SERVER_SNAPSHOT;
let hydrated = false;
const listeners = new Set<() => void>();

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
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
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
  saveSnapshot(next);
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
