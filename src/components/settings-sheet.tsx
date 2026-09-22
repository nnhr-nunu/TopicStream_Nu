"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Settings } from "lucide-react";

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
      .then((json: { configured?: boolean }) => setHostConfigured(Boolean(json.configured)))
      .catch(() => setHostConfigured(false));
  }, []);

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" size="icon-sm" aria-label="設定" />}>
        <Settings />
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(100%,24rem)] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>設定</SheetTitle>
          <SheetDescription>
            APIキーと呼び名はこのブラウザ内にだけ保存します。ログインは不要です。本番のキーはサーバーの環境変数です。
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-8">
          <section className="space-y-2">
            <Label>配色</Label>
            <ThemeSwitcher
              value={settings.colorTheme}
              onChange={(colorTheme) => onPatch({ colorTheme })}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              配信に出すなら「配信ダーク」。目を休めるなら「爽やか」か「落ち着き」。
            </p>
          </section>

          <section className="space-y-2">
            <Label htmlFor="nickname">呼び名（任意）</Label>
            <Input
              id="nickname"
              value={settings.nickname}
              placeholder="いっしょに見る画面に出ます"
              maxLength={24}
              onChange={(event) => onPatch({ nickname: event.target.value })}
            />
          </section>

          <section className="space-y-2">
            <Label htmlFor="gemini-key">Gemini APIキー（任意・上書き）</Label>
            <div className="flex gap-1.5">
              <Input
                id="gemini-key"
                type={showKey ? "text" : "password"}
                autoComplete="off"
                value={settings.geminiApiKey}
                placeholder="空ならホストの GEMINI_API_KEY"
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
            <p className="text-xs leading-5 text-muted-foreground">
              {hostConfigured
                ? "このホストには GEMINI_API_KEY があります。空欄のままでも本番のAIが使えます。"
                : "ホストに GEMINI_API_KEY がまだありません。空欄・失敗時はオフライン生成です。"}
              ここに入れると、このブラウザだけそのキーで上書きします。キーは git に置きません。発行は{" "}
              <a className="underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                Google AI Studio
              </a>
              。
            </p>
          </section>

          <section className="space-y-2">
            <Label>モデル</Label>
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
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>文字サイズ（配信で読む用）</Label>
              <span className="text-xs text-muted-foreground">{Math.round(settings.fontScale * 100)}%</span>
            </div>
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
          </section>

          <section className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="density">密度を詰める</Label>
              <p className="text-xs text-muted-foreground">ノード間隔を狭くします</p>
            </div>
            <Switch
              id="density"
              checked={settings.density === "compact"}
              onCheckedChange={(checked) => onPatch({ density: checked ? "compact" : "comfortable" })}
            />
          </section>

          <section className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="overlay-transparent">OBSの背景を透過</Label>
              <p className="text-xs text-muted-foreground">オーバーレイURLの初期値</p>
            </div>
            <Switch
              id="overlay-transparent"
              checked={settings.overlayTransparent}
              onCheckedChange={(checked) => onPatch({ overlayTransparent: checked })}
            />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
