"use client";

import { cn } from "@/lib/utils";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function BrandMark({
  onHome,
  compact = false,
  className,
}: {
  onHome?: () => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onHome}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-xl px-1.5 py-1 text-left transition hover:bg-muted/60",
        className,
      )}
      aria-label="TopicStream のホームへ"
    >
      <img
        src={`${base}/topicstream-logo.svg`}
        alt=""
        width={compact ? 28 : 32}
        height={compact ? 28 : 32}
        className="size-7 shrink-0 rounded-lg sm:size-8"
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-none tracking-tight">TopicStream</span>
        {compact ? null : (
          <span className="mt-0.5 hidden text-[10px] tracking-[0.18em] text-muted-foreground sm:block">HOME</span>
        )}
      </span>
    </button>
  );
}
