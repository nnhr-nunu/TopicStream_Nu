"use client";

import { useSyncExternalStore } from "react";

/** ルーレットでいま光っているカード（ページで 1 つ）。landed は止まったあと */
let current: { id: string | null; landed: boolean } = { id: null, landed: false };
const listeners = new Set<() => void>();

export function setRouletteHighlight(id: string | null, landed = false) {
  current = { id, landed };
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** ルーレットが止まったカード（止まるまでと、光が消えたあとは null） */
export function useRouletteLanded(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => (current.landed ? current.id : null),
    () => null,
  );
}

/** このカードがルーレットで光っているか（spin: 回っている途中 / hit: 当たり） */
export function useRouletteMark(nodeId: string): "spin" | "hit" | null {
  return useSyncExternalStore(
    subscribe,
    () => (current.id === nodeId ? (current.landed ? "hit" : "spin") : null),
    () => null,
  );
}
