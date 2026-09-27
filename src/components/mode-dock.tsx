"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleHelp, Grid3x3, ListChecks } from "lucide-react";

import { UsageGallery } from "@/components/usage-gallery";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import type { ExpandMode } from "@/lib/types";

const HINT_KEY = "topicstream-nu:hint-hold-v1";

const MODES = [
  { value: "abstract", label: "抽象展開", tip: "タップで切り口を 8 つ出して広げる", Icon: Grid3x3 },
  { value: "detail", label: "具体的", tip: "タップで「具体的にする」（具体的な話題・対応策などを 8 つ出す）", Icon: ListChecks },
] as const;

function hintSeen(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return true;
  }
}

function markHintSeen() {
  try {
    window.localStorage.setItem(HINT_KEY, "1");
  } catch {
    /* 保存できなくても、この画面では閉じる */
  }
}

/**
 * 盤面の左下: カードをタップしたときの広げ方（抽象展開 / 具体的）と、使い方。
 * 初めて広げたあとに一度だけ「長押しでメニュー・重ねると掛け合わせ」のヒントを出す。
 */
export function ModeDock({
  mode,
  onChange,
  expanded,
}: {
  mode: ExpandMode;
  onChange: (mode: ExpandMode) => void;
  /** 一度でも広げたか（広げる前にヒントを出しても、触るカードが無いので） */
  expanded: boolean;
}) {
  const coarse = useCoarsePointer();
  const [helpOpen, setHelpOpen] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (!expanded || hintSeen()) return;
    const timer = window.setTimeout(() => setHint(true), 1600);
    return () => window.clearTimeout(timer);
  }, [expanded]);

  const closeHint = () => {
    markHintSeen();
    setHint(false);
  };

  return (
    <div className="mode-dock">
      {hint ? (
        <div className="mode-dock-hint" role="status">
          <p>
            {coarse ? (
              <>
                カードを<b>長押し</b>でメニュー。
                <br />
                長押ししたまま別のカードに<b>重ねる</b>と掛け合わせ。
              </>
            ) : (
              <>
                カードにカーソルを乗せるとメニュー。
                <br />
                ドラッグして別のカードに<b>重ねる</b>と掛け合わせ。
              </>
            )}
          </p>
          <button type="button" className="mode-dock-hint-close" onClick={closeHint}>
            わかった
          </button>
        </div>
      ) : null}
      <div className="mode-dock-bar">
        <div role="radiogroup" aria-label="カードをタップしたときの広げ方" className="mode-dock-toggle">
          {MODES.map(({ value, label, tip, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              title={tip}
              className="mode-dock-option"
              onClick={() => onChange(value)}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mode-dock-help"
          aria-label="使い方"
          title="使い方"
          onClick={() => {
            closeHint();
            setHelpOpen(true);
          }}
        >
          <CircleHelp className="size-5" aria-hidden />
        </button>
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-h-[88svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>使い方</DialogTitle>
            <DialogDescription>横にスワイプすると続きが見られます。</DialogDescription>
          </DialogHeader>
          <UsageGallery />
          <ul className="space-y-1.5 text-sm leading-relaxed">
            <li>
              <b>タップ / クリック</b>: そのカードから広げる（左下の切り替えで「抽象展開」か「具体的」か）
            </li>
            <li>
              <b>{coarse ? "長押し" : "カーソルを乗せる"}</b>: メニュー（ピン・具体的にする・掛け合わせる・作り直す・付箋・コピー）
            </li>
            <li>
              <b>{coarse ? "長押ししたまま動かして重ねる" : "ドラッグして重ねる"}</b>: 2つを掛け合わせた話題を作る。どこにも重ねずに離せば元に戻ります
            </li>
            <li>
              <b>{coarse ? "指でなぞる / 2本指で広げる" : "ドラッグ / ホイール"}</b>: 盤面を動かす・拡大縮小
            </li>
            <li>
              <b>1つ戻る</b>（上の ↶）: 広げた・掛け合わせたのを取り消す
            </li>
          </ul>
          <Link href="/guide/" className="text-sm text-primary underline underline-offset-4">
            くわしい使い方・よくある質問
          </Link>
        </DialogContent>
      </Dialog>
    </div>
  );
}
