"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CREDIT_TEXT } from "@/lib/credit";

/** 配信・動画の概要欄に貼るクレジット。そのままコピーできる（使い方ページ） */
export function CreditNotice() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(CREDIT_TEXT);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2500);
  }

  return (
    <div className="space-y-2">
      <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-relaxed whitespace-pre-wrap break-all">
        {CREDIT_TEXT}
      </pre>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {state === "copied" ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
        {state === "copied" ? "コピーしました" : state === "failed" ? "コピーできませんでした（選んでコピーしてください）" : "クレジットをコピー"}
      </Button>
    </div>
  );
}
