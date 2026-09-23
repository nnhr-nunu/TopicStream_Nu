"use client";

import { useEffect, useState } from "react";

import { subscribeChatHearts } from "@/lib/live-hearts";

const HOLD_MS = 1600;

/** 直近に届いたハートの「+N」。続けて届いたら数を足して出し直す。 */
export type HeartBurst = {
  key: number;
  count: number;
};

let nextKey = 0;

export function useChatHearts(code: string): HeartBurst | null {
  const [burst, setBurst] = useState<HeartBurst | null>(null);

  useEffect(() => {
    if (!code) return;
    let timer: number | null = null;
    const stop = subscribeChatHearts((spark) => {
      if (!spark.codes.includes(code)) return;
      const n = Math.max(1, spark.count);
      nextKey += 1;
      const key = nextKey;
      setBurst((current) => ({ key, count: (current?.count ?? 0) + n }));
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setBurst(null), HOLD_MS);
    });
    return () => {
      stop();
      if (timer) window.clearTimeout(timer);
    };
  }, [code]);

  return burst;
}
