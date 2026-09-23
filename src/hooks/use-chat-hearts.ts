"use client";

import { useEffect, useState } from "react";

import { heartOrbit, subscribeChatHearts } from "@/lib/live-hearts";

const HOLD_MS = 6500;
const MAX_HEARTS = 16;

export type FestiveHeart = {
  id: number;
  dx: number;
  dy: number;
  scale: number;
};

let nextId = 0;

export function useChatHearts(code: string) {
  const [hearts, setHearts] = useState<FestiveHeart[]>([]);

  useEffect(() => {
    if (!code) return;
    const timers: number[] = [];
    const stop = subscribeChatHearts((spark) => {
      if (!spark.codes.includes(code)) return;
      const n = Math.max(1, Math.min(6, spark.count));
      const added: FestiveHeart[] = Array.from({ length: n }, () => {
        nextId += 1;
        const orbit = heartOrbit(nextId);
        return { id: nextId, ...orbit };
      });
      setHearts((current) => [...current, ...added].slice(-MAX_HEARTS));
      const timer = window.setTimeout(() => {
        const ids = new Set(added.map((heart) => heart.id));
        setHearts((current) => current.filter((heart) => !ids.has(heart.id)));
      }, HOLD_MS);
      timers.push(timer);
    });
    return () => {
      stop();
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [code]);

  return hearts;
}
