"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, KeyRound, Loader2 } from "lucide-react";

import { AiKeySteps } from "@/components/ai-key-steps";
import { Section } from "@/components/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { describeKeyCheck, type KeyCheckReply, type KeyCheckResult } from "@/lib/ai-key";
import { cn } from "@/lib/utils";

/**
 * 設定の「自分の AI キー」。入れると、みんなで分け合っている枠ではなく自分の Gemini のキーで話題を広げる。
 * キーはこのブラウザ（localStorage）にだけ置き、書き出し・引き継ぎには含めない
 */
export function AiKeySettings({
  apiKey,
  model,
  onChange,
}: {
  apiKey: string;
  model: string;
  onChange: (apiKey: string) => void;
}) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<KeyCheckResult | null>(null);

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const response = await fetch("/api/gemini/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() || undefined, model }),
      });
      const reply = (await response.json().catch(() => null)) as KeyCheckReply | null;
      setResult(describeKeyCheck(response.status, reply));
    } catch {
      setResult(describeKeyCheck(0, null));
    } finally {
      setTesting(false);
    }
  }

  return (
    <Section
      id="settings-ai-key"
      icon={<KeyRound />}
      title="自分の AI キー"
      description="AI は、みんなで 1 つの無料枠を分け合っています。混んで話題が出ないときは、自分のキー（無料で作れます）を入れると、自分の枠で使えます。入れなくても使えます。"
    >
      <div className="flex items-center gap-2">
        <Input
          type="password"
          value={apiKey}
          onChange={(event) => {
            onChange(event.target.value.trim());
            setResult(null);
          }}
          placeholder="ここにキーを貼り付け"
          aria-label="自分の AI キー（Gemini の API キー）"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1"
        />
        <Button size="sm" variant="outline" onClick={() => void test()} disabled={testing}>
          {testing ? <Loader2 className="animate-spin" /> : null}
          接続テスト
        </Button>
      </div>
      {apiKey ? (
        <p className="text-[11px] leading-4 text-muted-foreground">
          このブラウザにだけ保存しています。
          <button
            type="button"
            className="ml-1 underline underline-offset-2 hover:text-foreground"
            onClick={() => {
              onChange("");
              setResult(null);
            }}
          >
            キーを消す
          </button>
        </p>
      ) : null}
      {result ? (
        <p
          role="status"
          className={cn(
            "flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-xs leading-5 [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0",
            result.ok ? "bg-primary/10 text-foreground" : "bg-destructive/10 text-foreground",
          )}
        >
          {result.ok ? <CircleCheck className="text-primary" /> : <CircleAlert className="text-destructive" />}
          <span>{result.message}</span>
        </p>
      ) : null}
      <details className="text-xs leading-5">
        <summary className="cursor-pointer font-medium text-primary">キーの作り方（無料・5 分くらい）</summary>
        <div className="mt-2">
          <AiKeySteps />
          <p className="mt-2">
            <Link href="/guide#ai-key" className="text-primary underline underline-offset-2">
              使い方ページで、くわしく見る
            </Link>
          </p>
        </div>
      </details>
    </Section>
  );
}
