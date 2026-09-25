"use client";

import { BookOpen, HeartHandshake, Lightbulb, MessageCircle, RefreshCcw, Target, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { MODE_PRESETS, modePreset, parseMode } from "@/lib/modes";
import type { BoardMode } from "@/lib/types";

export const MODE_ICONS: Record<BoardMode, LucideIcon> = {
  chat: MessageCircle,
  advice: HeartHandshake,
  idea: Lightbulb,
  goal: Target,
  review: RefreshCcw,
  learn: BookOpen,
};

/** ホームの入力欄の上に置く用途の切り替え。既定は雑談で、ほかは押したときだけ変わる */
export function ModePicker({
  value,
  onChange,
  disabled,
}: {
  value: BoardMode;
  onChange: (mode: BoardMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mode-picker" role="radiogroup" aria-label="使い方">
      {MODE_PRESETS.map((preset) => {
        const Icon = MODE_ICONS[preset.id];
        const selected = preset.id === value;
        return (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={selected}
            data-mode={preset.id}
            className={cn("mode-chip", selected && "mode-chip-active")}
            onClick={() => onChange(preset.id)}
            disabled={disabled}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}

/** 雑談以外のボードに付ける小さな印（雑談は何も出さない＝今までの見た目のまま） */
export function ModeBadge({ mode, className }: { mode: BoardMode | undefined; className?: string }) {
  const id = parseMode(mode);
  if (id === "chat") return null;
  const Icon = MODE_ICONS[id];
  return (
    <span className={cn("mode-badge", className)} data-mode={id}>
      <Icon className="size-3 shrink-0" aria-hidden />
      {modePreset(id).label}
    </span>
  );
}
