"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleHelp, Dices, Grid3x3, ListChecks } from "lucide-react";

import { UsageGallery } from "@/components/usage-gallery";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import type { ExpandMode } from "@/lib/types";

const HINT_KEY = "topicstream-nu:hint-hold-v1";
/** 最初の 3×3 で一度だけ出す「カードを押すとさらに広がる」 */
const EXPAND_HINT_KEY = "topicstream-nu:hint-expand-v1";

const MODES = [
  { value: "abstract", label: "広げる", tip: "カードを押すと、切り口を 8 つ出して広げる", Icon: Grid3x3 },
  { value: "detail", label: "具体化", tip: "カードを押すと、具体的な話題・対応策などを 8 つ出す", Icon: ListChecks },
] as const;

function hintSeen(key = HINT_KEY): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return true;
  }
}

function markHintSeen(key = HINT_KEY) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* 保存できなくても、この画面では閉じる */
  }
}

/**
 * 盤面の左下: カードをタップしたときの広げ方（広げる / 具体化）と、使い方。
 * 最初の 3×3 では一度だけ「カードを押すとさらに 8 つ広がる」、スマホではそのあと一度だけ
 * 「長押しでメニュー・重ねると掛け合わせ」のヒントを出す。
 */
export function ModeDock({
  mode,
  onChange,
  expanded,
  opened = 0,
  onRoulette,
  spinning = false,
}: {
  mode: ExpandMode;
  onChange: (mode: ExpandMode) => void;
  /** 一度でも広げたか（広げる前にヒントを出しても、触るカードが無いので） */
  expanded: boolean;
  /** 広げたカードの数（1 なら最初の 3×3 だけ） */
  opened?: number;
  /** 話題ルーレット（まだ話していないカードから次の話題を選ぶ） */
  onRoulette?: () => void;
  spinning?: boolean;
}) {
  const coarse = useCoarsePointer();
  const [helpOpen, setHelpOpen] = useState(false);
  const [hint, setHint] = useState(false);
  const [expandHint, setExpandHint] = useState(false);
  const showExpandHint = expandHint && opened === 1;

  useEffect(() => {
    // 最初の 3×3 が並んだら、ほかのカードも押せることを伝える（初めての人は中央のお題で止まりやすい）
    if (opened !== 1 || hintSeen(EXPAND_HINT_KEY)) return;
    const timer = window.setTimeout(() => setExpandHint(true), 1200);
    return () => window.clearTimeout(timer);
  }, [opened]);

  useEffect(() => {
    // 2 つ目を広げた＝もう分かっているので、次からは出さない
    if (opened >= 2) markHintSeen(EXPAND_HINT_KEY);
  }, [opened]);

  useEffect(() => {
    // PC はカーソルを乗せればメニューが出るので案内しない（スマホの長押しは触っても気づけない）。
    // 広げ方の案内と重ならないよう、そちらを見終えてから
    if (!coarse || !expanded || showExpandHint || hintSeen() || !hintSeen(EXPAND_HINT_KEY)) return;
    const timer = window.setTimeout(() => setHint(true), 1600);
    return () => window.clearTimeout(timer);
  }, [coarse, expanded, opened, showExpandHint]);

  const closeExpandHint = () => {
    markHintSeen(EXPAND_HINT_KEY);
    setExpandHint(false);
  };

  const closeHint = () => {
    markHintSeen();
    setHint(false);
  };

  return (
    <div className="mode-dock">
      {showExpandHint ? (
        <div className="mode-dock-hint" role="status">
          <p>
            気になるカードを<b>{coarse ? "タップ" : "クリック"}</b>すると、
            <br />
            そこからさらに <b>8 つ</b>広がります。
          </p>
          <button type="button" className="mode-dock-hint-close" onClick={closeExpandHint}>
            わかった
          </button>
        </div>
      ) : hint ? (
        <div className="mode-dock-hint" role="status">
          <p>
            カードを<b>長押し</b>でメニュー。
            <br />
            長押ししたまま別のカードに<b>重ねる</b>と掛け合わせ。
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
        {onRoulette ? (
          <button
            type="button"
            className="mode-dock-roulette"
            onClick={onRoulette}
            disabled={spinning || !expanded}
            aria-label="話題ルーレット（まだ話していないカードから次の話題を選ぶ）"
            title={expanded ? "まだ話していないカードから次の話題を選ぶ（N キー）" : "お題を広げると使えます"}
            data-spinning={spinning || undefined}
          >
            <Dices className="size-4" aria-hidden />
            <span className="mode-dock-roulette-text">ルーレット</span>
          </button>
        ) : null}
        <button
          type="button"
          className="mode-dock-help"
          aria-label="使い方"
          title="使い方"
          onClick={() => {
            closeExpandHint();
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
            <DialogDescription className="sr-only">TopicStream でできること</DialogDescription>
          </DialogHeader>
          <UsageGallery />
          {coarse ? (
            <ul className="space-y-1.5 text-sm leading-relaxed">
              <li>
                <b>長押し</b>: メニュー
              </li>
              <li>
                <b>長押ししたまま動かして重ねる</b>: 掛け合わせ
              </li>
            </ul>
          ) : null}
          <Link href="/guide/" className="text-sm text-primary underline underline-offset-4">
            くわしい使い方・よくある質問
          </Link>
        </DialogContent>
      </Dialog>
    </div>
  );
}
