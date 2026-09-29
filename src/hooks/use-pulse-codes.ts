"use client";

import { useSyncExternalStore } from "react";

import { subscribePulse } from "@/lib/live-pulse";

const HOLD_MS = 2200;

/**
 * コメントで呼ばれたマスを光らせておく表（ページで 1 つ）。
 * カードごとに購読すると、コメントのたびに全カードが描き直されるので、各カードは自分のマスが光っているかだけを読む。
 */
const glowing = new Map<string, number>();
const listeners = new Set<() => void>();
let stopBus: (() => void) | null = null;

function notify() {
  for (const listener of [...listeners]) listener();
}

function onCodes(codes: string[]) {
  for (const code of codes) {
    const previous = glowing.get(code);
    if (previous !== undefined) window.clearTimeout(previous);
    // 続けて呼ばれたら、最後に呼ばれたときから数え直す
    glowing.set(
      code,
      window.setTimeout(() => {
        glowing.delete(code);
        notify();
      }, HOLD_MS),
    );
  }
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  stopBus ??= subscribePulse(onCodes);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    stopBus?.();
    stopBus = null;
    for (const timer of glowing.values()) window.clearTimeout(timer);
    glowing.clear();
  };
}

/** このマス（例: 1E）がコメントで呼ばれて光っている間 true */
export function usePulsing(code: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => Boolean(code) && glowing.has(code),
    () => false,
  );
}
