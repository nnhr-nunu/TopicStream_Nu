"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Eye, EyeOff, MonitorPlay, Settings } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Switch } from "@/components/ui/switch";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { GEMINI_MODELS } from "@/lib/constants";
import type { Settings as AppSettings } from "@/lib/types";

function Row({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-2">
      <Label htmlFor={htmlFor} className="truncate text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function SettingsSheet({
  settings,
  onPatch,
}: {
  settings: AppSettings;
  onPatch: (patch: Partial<AppSettings>) => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const [hostConfigured, setHostConfigured] = useState(false);

  useEffect(() => {
    void fetch("/api/gemini")
      .then((response) => response.json())
      .then((json: { configured?: boolean }) => {
        setHostConfigured(Boolean(json.configured));
      })
      .catch(() => {
        setHostConfigured(false);
      });
  }, []);

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" size="icon-sm" aria-label="設定" />}>
        <Settings />
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(100%,22rem)] overflow-y-auto">
        <SheetHeader className="gap-0 pb-1">
          <SheetTitle>設定</SheetTitle>
          <SheetDescription className="text-xs">このブラウザだけ</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-8">
          <section className="space-y-2">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">AI</p>
            <Row label="Gemini" htmlFor="gemini-key">
              <div className="flex gap-1">
                <Input
                  id="gemini-key"
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  value={settings.geminiApiKey}
                  placeholder={hostConfigured ? "ホストのキーを使う" : "任意・上書き"}
                  onChange={(event) => onPatch({ geminiApiKey: event.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={showKey ? "キーを隠す" : "キーを表示"}
                  onClick={() => setShowKey((value) => !value)}
                >
                  {showKey ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </Row>
            <Row label="モデル">
              <Select
                value={settings.geminiModel}
                onValueChange={(value) => {
                  if (typeof value === "string") onPatch({ geminiModel: value });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GEMINI_MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
          </section>

          <section className="space-y-2">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">マップ</p>
            <Row label="広げかた">
              <Select
                value={settings.generationLayout}
                onValueChange={(value) => {
                  if (value === "radial" || value === "mandala") onPatch({ generationLayout: value });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mandala">マンダラート</SelectItem>
                  <SelectItem value="radial">放射</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="テーマ">
              <ThemeSwitcher
                value={settings.colorTheme}
                onChange={(colorTheme) => onPatch({ colorTheme })}
              />
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
          </section>

          <details className="rounded-lg border border-border/70 px-3 py-2">
            <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground">その他</summary>
            <div className="mt-3 space-y-2">
              <Row label="呼び名" htmlFor="nickname">
                <Input
                  id="nickname"
                  value={settings.nickname}
                  placeholder="いっしょに見る"
                  maxLength={24}
                  onChange={(event) => onPatch({ nickname: event.target.value })}
                />
              </Row>
              <Row label="YouTube" htmlFor="youtube-key">
                <Input
                  id="youtube-key"
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  value={settings.youtubeApiKey}
                  placeholder="任意"
                  onChange={(event) => onPatch({ youtubeApiKey: event.target.value })}
                />
              </Row>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="density" className="text-xs text-muted-foreground">
                  密度を詰める
                </Label>
                <Switch
                  id="density"
                  checked={settings.density === "compact"}
                  onCheckedChange={(checked) => onPatch({ density: checked ? "compact" : "comfortable" })}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="overlay-transparent" className="text-xs text-muted-foreground">
                  OBS背景を透過
                </Label>
                <Switch
                  id="overlay-transparent"
                  checked={settings.overlayTransparent}
                  onCheckedChange={(checked) => onPatch({ overlayTransparent: checked })}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                nativeButton={false}
                render={
                  <Link
                    href={settings.overlayTransparent ? "/overlay?transparent=1" : "/overlay"}
                    target="_blank"
                  />
                }
              >
                <MonitorPlay />
                OBSを開く
              </Button>
            </div>
          </details>
        </div>
      </SheetContent>
    </Sheet>
  );
}
