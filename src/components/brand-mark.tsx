"use client";

import { cn } from "@/lib/utils";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** ロゴ兼「ホーム」ボタン。パンくずの先頭に置く。 */
export function BrandMark({
  onHome,
  active = false,
  className,
}: {
  onHome?: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onHome}
      className={cn("app-crumb-home", active && "app-crumb-home-active", className)}
      aria-label="ホームへ（キーワード入力とテーマ一覧）"
      aria-current={active ? "page" : undefined}
      title="ホーム"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 静的エクスポート（Pages）でも同じパスで出すため */}
      <img src={`${base}/topicstream-logo.svg`} alt="" width={26} height={26} className="size-[26px] shrink-0 rounded-lg" />
      <span className="hidden text-sm font-semibold tracking-tight sm:inline">
        TopicStream<span className="ml-0.5 text-xs font-medium text-muted-foreground">(ぬ)</span>
      </span>
    </button>
  );
}
