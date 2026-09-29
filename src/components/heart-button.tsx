"use client";

import { Heart } from "lucide-react";

import { cn } from "@/lib/utils";

/** カードの右上に置く ♡ と数。押した瞬間に見た目を変える（数の保存は呼ぶ側） */
export function HeartButton({
  liked,
  count,
  onToggle,
  disabled = false,
  className,
}: {
  liked: boolean;
  count: number;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn("card-heart", liked && "card-heart-on", className)}
      aria-pressed={liked}
      aria-label={liked ? "ハートを外す" : "ハートを付ける"}
      onClick={onToggle}
      disabled={disabled}
    >
      <Heart className={cn("size-3.5", liked && "fill-current")} />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
