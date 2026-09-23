"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Eye, EyeOff, MonitorPlay, Palette, PlugZap, Settings, Sparkles, Users } from "lucide-react";
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

const LAYOUT_ITEMS = [
  { value: "mandala", label: "マンダラート（3×3）" },
  { value: "radial", label: "放射" },
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

function SwitchRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

type KeyCheck = {
  ok: boolean;
  source?: "browser" | "server" | "none";
  httpStatus?: number;
  googleStatus?: string;
  googleMessage?: string;
  models: string[];
};

function describeKeyCheck(result: KeyCheck, model: string): { tone: "ok" | "warn" | "error"; text: string } {
  const where = result.source === "browser" ? "この画面のキー" : "サーバーのキー";
  if (result.source === "none") {
    return { tone: "error", text: "キーがありません。上に入れるか、サーバーの GEMINI_API_KEY を設定してください。" };
  }
  if (!result.ok) {
    const code = [result.httpStatus, result.googleStatus].filter(Boolean).join(" ");
    const message = result.googleMessage ? `「${result.googleMessage}」` : "";
    return { tone: "error", text: `${where}が使えません（${code || "通信エラー"}）${message}` };
  }
  if (!result.models.includes(model)) {
    return {
      tone: "warn",
      text: `${where}は有効ですが、${model} は使えません。使える例: ${result.models.slice(0, 4).join(", ") || "なし"}`,
    };
  }
  return { tone: "ok", text: `${where}は有効です。${model} を使えます。` };
}

function GeminiKeyCheck({ apiKey, model }: { apiKey: string; model: string }) {
  const [state, setState] = useState<"idle" | "busy" | KeyCheck>("idle");
  const result = typeof state === "object" ? describeKeyCheck(state, model) : null;
  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          try {
            const response = await fetch("/api/gemini/check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ apiKey: apiKey || undefined }),
            });
            if (!response.ok) throw new Error(String(response.status));
            setState((await response.json()) as KeyCheck);
          } catch {
            setState({ ok: false, googleMessage: "接続テストはサーバー版（Vercel / npm run dev）でだけ使えます", models: [] });
          }
        }}
      >
        <PlugZap />
        {state === "busy" ? "確認中…" : "接続テスト"}
      </Button>
      {result ? (
        <p
          role="status"
          className={
            result.tone === "ok"
              ? "rounded-md bg-primary/10 px-2 py-1.5 text-[11px] leading-4 text-foreground"
              : result.tone === "warn"
                ? "rounded-md bg-amber-500/15 px-2 py-1.5 text-[11px] leading-4 text-foreground"
                : "rounded-md bg-destructive/10 px-2 py-1.5 text-[11px] leading-4 text-destructive"
          }
        >
          {result.text}
        </p>
      ) : null}
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
      <SheetTrigger render={<Button variant="ghost" size="icon-sm" aria-label="設定" title="設定" />}>
        <Settings />
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(100%,24rem)] gap-0 overflow-y-auto">
        <SheetHeader className="gap-0.5 pb-3">
          <SheetTitle>設定</SheetTitle>
          <SheetDescription className="text-xs">変更はすぐ保存されます（このブラウザだけ）。</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4 pb-8">
          <Section
            icon={<Sparkles />}
            title="AIで話題を作る"
            description={
              hostConfigured
                ? "サーバーにキーが設定済みです。自分のキーを使うときだけ入れてください。"
                : "キーが無くてもオフラインの候補で動きます。"
            }
          >
            <Row label="Gemini キー" htmlFor="gemini-key">
              <div className="flex gap-1">
                <Input
                  id="gemini-key"
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  value={settings.geminiApiKey}
                  placeholder={hostConfigured ? "サーバーのキーを使う" : "任意"}
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
                items={GEMINI_MODELS}
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
            <GeminiKeyCheck apiKey={settings.geminiApiKey} model={settings.geminiModel} />
          </Section>

          <Section icon={<Palette />} title="マップの見た目">
            <Row label="広げかた" hint="マンダラートは3×3のマス、放射は中心から広がります。">
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
            <SwitchRow
              id="density"
              label="カードの間隔を詰める"
              checked={settings.density === "compact"}
              onChange={(checked) => onPatch({ density: checked ? "compact" : "comfortable" })}
            />
          </Section>

          <Section icon={<Users />} title="配信・視聴者" description="配信URLは画面下の「配信と連携」から設定します。">
            <Row label="呼び名" htmlFor="nickname" hint="「いっしょに見るリンク」で視聴者に表示されます。">
              <Input
                id="nickname"
                value={settings.nickname}
                placeholder="配信者の名前"
                maxLength={24}
                onChange={(event) => onPatch({ nickname: event.target.value })}
              />
            </Row>
            <Row label="YouTube キー" htmlFor="youtube-key" hint="任意。サーバー側に無いときだけ使います。">
              <Input
                id="youtube-key"
                type={showKey ? "text" : "password"}
                autoComplete="off"
                value={settings.youtubeApiKey}
                placeholder="任意"
                onChange={(event) => onPatch({ youtubeApiKey: event.target.value })}
              />
            </Row>
          </Section>

          <Section icon={<MonitorPlay />} title="OBS オーバーレイ" description="ブラウザソースに読み込む、配信画面用のページです。">
            <SwitchRow
              id="overlay-transparent"
              label="背景を透過する"
              checked={settings.overlayTransparent}
              onChange={(checked) => onPatch({ overlayTransparent: checked })}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              nativeButton={false}
              render={
                <Link href={settings.overlayTransparent ? "/overlay?transparent=1" : "/overlay"} target="_blank" />
              }
            >
              <MonitorPlay />
              OBS 用ページを開く
            </Button>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
