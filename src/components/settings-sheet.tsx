"use client";

import { useState, type ReactNode } from "react";
import { MonitorPlay, Palette, PlugZap, Settings, Users } from "lucide-react";
import Link from "next/link";

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
import { Switch } from "@/components/ui/switch";
import { ThemeSwitcher } from "@/components/theme-switcher";
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
  generation?: {
    model: string;
    ok: boolean;
    reason?: string;
    googleStatus?: string;
    googleMessage?: string;
    topics?: string[];
    firstChunkMs?: number;
    totalMs?: number;
    thoughtsTokens?: number;
  };
};

function seconds(ms?: number): string {
  return typeof ms === "number" ? `${(ms / 1000).toFixed(1)}秒` : "—";
}

function describeKeyCheck(result: KeyCheck): { tone: "ok" | "warn" | "error"; text: string } {
  const where = "AI";
  if (result.source === "none") {
    return { tone: "error", text: "この公開版では AI を使いません（オフラインの候補で動きます）。" };
  }
  if (!result.ok) {
    const code = [result.httpStatus, result.googleStatus].filter(Boolean).join(" ");
    const message = result.googleMessage ? `「${result.googleMessage}」` : "";
    return { tone: "error", text: `${where}が使えません（${code || "通信エラー"}）${message}` };
  }
  const gen = result.generation;
  if (!gen) return { tone: "ok", text: `${where}は有効です。` };
  const timing = `最初の応答 ${seconds(gen.firstChunkMs)}・合計 ${seconds(gen.totalMs)}`;
  if (gen.ok) {
    const slow = (gen.totalMs ?? 0) > 6_000;
    return {
      tone: slow ? "warn" : "ok",
      text: `${where}で ${gen.model} が生成できました（${timing}）。例: ${gen.topics?.join("、") ?? ""}${slow ? "。応答が遅めです。" : ""}`,
    };
  }
  const google = [gen.reason, gen.googleStatus].filter(Boolean).join(" ");
  const message = gen.googleMessage ? `「${gen.googleMessage}」` : "";
  const hint =
    gen.reason === "timeout"
      ? "Google 側の応答が遅れています。別のモデルを選ぶか、時間をおいて試してください。"
      : gen.googleStatus === "RESOURCE_EXHAUSTED"
        ? "このキーの利用枠を使い切っているか、枠がありません。AI Studio の使用量と上限を確認してください。"
        : "";
  return {
    tone: "error",
    text: `AI に接続できましたが、${gen.model} で生成できませんでした（${google}・${seconds(gen.totalMs)}）${message}。${hint}`,
  };
}

function GeminiKeyCheck() {
  const [state, setState] = useState<"idle" | "busy" | KeyCheck>("idle");
  const result = typeof state === "object" ? describeKeyCheck(state) : null;
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
              body: JSON.stringify({}),
            });
            if (!response.ok) throw new Error(String(response.status));
            setState((await response.json()) as KeyCheck);
          } catch {
            setState({ ok: false, googleMessage: "この公開版では AI を使いません（オフラインの候補で動きます）", models: [] });
          }
        }}
      >
        <PlugZap />
        {state === "busy" ? "生成して確認中…" : "AI を試す"}
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
            <Row label="広げかた" hint="マンダラートは3×3のマス、放射（マインドマップ）は中心から枝分かれして広がります。">
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

          <Section icon={<Users />} title="配信" description="配信URLは画面下の「配信と連携」から設定します。">
            <Row label="コメントの文字" hint="コメント欄を配信に映すときは大きめが見やすいです。欄の A−/A＋ でも変えられます。">
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
          <details className="rounded-xl border border-border/70 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
              AI の話題づくりがうまくいかないとき
            </summary>
            <div className="mt-3 space-y-2">
              <p className="text-[11px] leading-4 text-muted-foreground">
                AI が使えないときも、オフラインの候補で話題は広がります。うまく出ないときは、ここで実際に生成して確かめられます。
              </p>
              <GeminiKeyCheck />
            </div>
          </details>
        </div>
      </SheetContent>
    </Sheet>
  );
}
