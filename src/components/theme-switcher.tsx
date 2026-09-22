"use client";

import { COLOR_THEMES, asColorTheme, type ColorTheme } from "@/lib/color-theme";
import { cn } from "@/lib/utils";

export function ThemeSwitcher({
  value,
  onChange,
  compact = false,
}: {
  value: ColorTheme | string;
  onChange: (theme: ColorTheme) => void;
  compact?: boolean;
}) {
  const current = asColorTheme(value);
  return (
    <div
      className={cn("flex items-center gap-0.5 rounded-full border border-border/70 bg-background/60 p-0.5", compact && "max-w-full")}
      role="radiogroup"
      aria-label="配色"
    >
      {COLOR_THEMES.map((theme) => (
        <button
          key={theme.id}
          type="button"
          role="radio"
          aria-checked={current === theme.id}
          className={cn(
            "rounded-full px-2 py-1 text-[11px] tracking-wide transition",
            current === theme.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(theme.id)}
        >
          {theme.label}
        </button>
      ))}
    </div>
  );
}
