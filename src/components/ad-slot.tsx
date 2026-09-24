"use client";

import { useEffect, useRef } from "react";

import { adConfig } from "@/lib/ads";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/** ページ下部のディスプレイ広告。ID 未設定・広告なし（unfilled）のときは何も見せない。 */
export function AdSlot() {
  const ref = useRef<HTMLModElement>(null);
  const { client, slot } = adConfig;

  useEffect(() => {
    const ins = ref.current;
    // StrictMode の二重実行や再マウントで同じ枠へ二度 push しない。
    if (!ins || ins.dataset.adsbygoogleStatus) return;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      // 広告ブロッカーなどで失敗しても画面は壊さない。
    }
  }, []);

  if (!client || !slot) return null;

  return (
    <aside className="ad-slot mx-auto w-full max-w-2xl space-y-1 px-4 pb-8 sm:px-6" aria-label="広告" data-testid="ad-slot">
      <p className="px-1 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">広告</p>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <ins
          ref={ref}
          className="adsbygoogle block min-h-[100px]"
          data-ad-client={client}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
          {...(process.env.NODE_ENV !== "production" ? { "data-adtest": "on" } : {})}
        />
      </div>
    </aside>
  );
}
