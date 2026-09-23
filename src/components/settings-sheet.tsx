"use client";

import { useEffect, useState } from "react";
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
          <SheetDescription>このブラウザにだけ残ります。ログインは不要です。</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-8">
          <section className="space-y-2">
            <Label htmlFor="stream-url">配信URL</Label>
            <Input
              id="stream-url"
              value={settings.streamUrl}
              placeholder="YouTube か Twitch の配信URL"
              onChange={(event) => onPatch({ streamUrl: event.target.value })}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              このマップのコメントを読むためのURLです。ホームの一覧は TopicStream を使っている枠の案内で、貼った配信はそこに一行で出ます。Pages ではテストコメントで 1E（最初の中央）を確認できます。Twitchは匿名、YouTubeはキーか YOUTUBE_API_KEY が必要です。
            </p>
          </section>

          <section className="space-y-2">
            <Label htmlFor="youtube-key">YouTube Data APIキー（任意）</Label>
            <Input
              id="youtube-key"
              type={showKey ? "text" : "password"}
              autoComplete="off"
              value={settings.youtubeApiKey}
              placeholder="空ならホストの YOUTUBE_API_KEY"
              onChange={(event) => onPatch({ youtubeApiKey: event.target.value })}
            />
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium">つかいかた</p>
            <p className="text-xs leading-6 text-muted-foreground">
              キーワードを押すと 3×3 が広がります。中央は同じ ID のまま色が変わります。メニューはカードの上に横並び。カードをクリックで広げる。再生成はそのマスの文だけ。📝は付箋。♡はお気に入り。ピンは NOW。コメントのマスID（最初の中央は 1E）でカードが光ります。ロゴでホームへ。
            </p>
          </section>

          <section className="space-y-2">
            <Label>広げかた</Label>
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
                <SelectItem value="mandala">マンダラート（初期値・3×3の9マス）</SelectItem>
                <SelectItem value="radial">放射</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs leading-6 text-muted-foreground">
              マンダラートはクリックすると新しい 3×3 が9マス出ます。中央は元の話題（同じID・太線・新しい色）、周囲8マスは薄い同じ色です。線は関連する中心同士だけ。放射は親のまわりに円で広がります。
            </p>
          </section>

          <section className="space-y-2">
            <Label>配色</Label>
            <ThemeSwitcher
              value={settings.colorTheme}
              onChange={(colorTheme) => onPatch({ colorTheme })}
            />
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
                ? "ホストに GEMINI_API_KEY があります。空欄のままでも AI が使えます。"
                : "空欄・失敗時はオフライン生成です。公開の GitHub Pages ではサーバーキーは使えません。"}
              発行は{" "}
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

          <Button
            variant="outline"
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
            OBSオーバーレイを開く
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
