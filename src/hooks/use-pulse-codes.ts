"use client";

import { useEffect, useState } from "react";

import { subscribePulse } from "@/lib/live-pulse";

const HOLD_MS = 2200;

export function usePulseCodes() {
  const [codes, setCodes] = useState<string[]>([]);

  useEffect(() => {
    const timers: number[] = [];
    const stop = subscribePulse((incoming) => {
      setCodes((current) => [...new Set([...current, ...incoming])]);
      const timer = window.setTimeout(() => {
        setCodes((current) => current.filter((code) => !incoming.includes(code)));
      }, HOLD_MS);
      timers.push(timer);
    });
    return () => {
      stop();
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, []);

  return codes;
}
