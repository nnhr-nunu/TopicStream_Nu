"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { adConfig } from "@/lib/ads";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/** 1 枠ぶんの `<ins>`。マウント時に一度だけ AdSense へ埋めてもらう。 */
function AdUnit({ slot, className, responsive }: { slot: string; className: string; responsive: boolean }) {
  const ref = useRef<HTMLModElement>(null);

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

  return (
    <ins
      ref={ref}
      className={className}
      data-ad-client={adConfig.client}
      data-ad-slot={slot}
      {...(responsive ? { "data-ad-format": "auto", "data-full-width-responsive": "true" } : {})}
      {...(process.env.NODE_ENV !== "production" ? { "data-adtest": "on" } : {})}
    />
  );
}

/** ページ下部のディスプレイ広告。ID 未設定・広告なし（unfilled）のときは何も見せない。 */
export function AdSlot({ className = "mx-auto w-full max-w-2xl px-4 pb-8 sm:px-6" }: { className?: string }) {
  if (!adConfig.client || !adConfig.slot) return null;

  return (
    <aside className={`ad-slot space-y-1 ${className}`} aria-label="広告" data-testid="ad-slot">
      <p className="px-1 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">広告</p>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <AdUnit slot={adConfig.slot} className="adsbygoogle block min-h-[100px]" responsive />
      </div>
    </aside>
  );
}

/** サイド広告を出す最小の画面幅。本文（56rem）+ 左右の枠（160px + 余白）が収まる幅。 */
export const SIDE_AD_QUERY = "(min-width: 1360px)";

function subscribeWide(onChange: () => void) {
  const media = window.matchMedia(SIDE_AD_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * 横幅が十分にあるときだけ出す縦長（160×600）の広告。
 * 非表示（幅 0）の枠へ push すると AdSense がエラーになるので、CSS で隠さず描画自体を切り替える。
 */
export function SideAdRail() {
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(SIDE_AD_QUERY).matches,
    () => false,
  );
  if (!wide || !adConfig.client || !adConfig.sideSlot) return null;

  return (
    <aside className="ad-slot sticky top-24 w-[160px] space-y-1" aria-label="広告" data-testid="side-ad-slot">
      <p className="px-1 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">広告</p>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <AdUnit slot={adConfig.sideSlot} className="adsbygoogle block h-[600px] w-[160px]" responsive={false} />
      </div>
    </aside>
  );
}
