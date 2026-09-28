"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Activity, Palette, Settings, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { loadAiUsage, subscribeAiUsage, type AiUsageDay } from "@/lib/ai-usage";
import { COMMENT_SCALE_MAX, COMMENT_SCALE_MIN } from "@/lib/constants";
import type { Settings as AppSettings } from "@/lib/types";

const LAYOUT_ITEMS = [
  { value: "mandala", label: "マンダラート（3×3）" },
  { value: "radial", label: "放射（マインドマップ）" },
] as const;

function Row({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2">
        <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        <div className="min-w-0">{children}</div>
      </div>
      {hint ? <p className="pl-[6rem] text-[11px] leading-4 text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-3">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold [&_svg]:size-4 [&_svg]:text-primary">
          {icon}
          {title}
        </h3>
        {description ? <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** 設定の一番下にそれとなく出す、この端末からの今日の AI 利用（開発中の目安） */
function AiUsagePanel() {
  const [usage, setUsage] = useState<AiUsageDay | null>(null);
  useEffect(() => {
    const read = () => setUsage(loadAiUsage());
    read();
    return subscribeAiUsage(read);
  }, []);
  if (!usage) return null;
  const failures = Object.entries(usage.failures).sort((a, b) => b[1] - a[1]);
  const time = (at: number) => new Date(at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  return (
    <section className="space-y-1.5 rounded-xl border border-dashed border-border/70 p-3 text-[11px] leading-4 text-muted-foreground">
      <h3 className="flex items-center gap-1.5 font-semibold [&_svg]:size-3.5">
        <Activity />
        AI の利用状況（今日・この端末から）
      </h3>
      {usage.requests === 0 ? (
        <p>今日はまだ AI を使っていません。</p>
      ) : (
        <>
          <p className="tabular-nums">
            広げた {usage.requests} 回 · Gemini へ送った {usage.calls} 回 · 約 {usage.tokens.toLocaleString()} トークン
          </p>
          {usage.fallbacks > 0 ? (
            <p className="tabular-nums">
              AI の語が取れなかった {usage.fallbacks} 回（{failures.map(([reason, count]) => `${reason} ×${count}`).join(" / ")}）
            </p>
          ) : null}
          {usage.last ? (
            <p className="break-words">
              直近の失敗 {time(usage.last.at)}: {usage.last.reason}・{usage.last.model}
              {usage.last.attempts && usage.last.attempts.length > 1 ? `（試した順: ${usage.last.attempts.join(" → ")}）` : null}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

export function SettingsSheet({
  settings,
  onPatch,
}: {
  settings: AppSettings;
  onPatch: (patch: Partial<AppSettings>) => void;
}) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" size="icon-sm" aria-label="設定" title="設定" />}>
        <Settings />
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(100%,24rem)] gap-0 overflow-y-auto">
        <SheetHeader className="gap-0.5 pb-3">
          <SheetTitle>設定</SheetTitle>
          <SheetDescription className="text-xs">変更はすぐ保存されます（このブラウザだけ）。</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4 pb-8">
          <Section icon={<Palette />} title="マップの見た目">
            <Row label="広げかた">
              <Select
                items={LAYOUT_ITEMS}
                value={settings.generationLayout}
                onValueChange={(value) => {
                  if (value === "radial" || value === "mandala") onPatch({ generationLayout: value });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LAYOUT_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label="配色">
              <ThemeSwitcher value={settings.colorTheme} onChange={(colorTheme) => onPatch({ colorTheme })} />
            </Row>
            <Row label="文字サイズ">
              <div className="flex items-center gap-2">
                <Slider
                  min={0.85}
                  max={1.6}
                  step={0.05}
                  value={[settings.fontScale]}
                  onValueChange={(value) => {
                    const next = Array.isArray(value) ? value[0] : value;
                    if (typeof next === "number") onPatch({ fontScale: next });
                  }}
                />
                <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                  {Math.round(settings.fontScale * 100)}%
                </span>
              </div>
            </Row>
          </Section>

          <Section icon={<Users />} title="配信" description="配信URLは画面下の「配信と連携」から設定します。">
            <Row label="コメントの文字">
              <div className="flex items-center gap-2">
                <Slider
                  min={COMMENT_SCALE_MIN}
                  max={COMMENT_SCALE_MAX}
                  step={0.1}
                  value={[settings.commentScale]}
                  onValueChange={(value) => {
                    const next = Array.isArray(value) ? value[0] : value;
                    if (typeof next === "number") onPatch({ commentScale: next });
                  }}
                />
                <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                  {Math.round(settings.commentScale * 100)}%
                </span>
              </div>
            </Row>
          </Section>

          <AiUsagePanel />

          {/*
            OBS オーバーレイ（/overlay）の入口は外した。OBS のブラウザソースはブラウザと保存領域が別なので
            自分のボードが映らず、ウィンドウキャプチャか「いっしょに見るリンク」で足りるため。
            既に OBS に設定している人のために /overlay のページ自体は残してある。
          */}
        </div>
      </SheetContent>
    </Sheet>
  );
}
