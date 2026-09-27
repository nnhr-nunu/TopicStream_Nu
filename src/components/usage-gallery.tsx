"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * できること（操作の説明はしない。触れば分かるので）。
 * 画像は scripts/capture-guide.mjs で撮り直せる（public/guide/）
 */
export const USAGE_STEPS = [
  {
    image: "start",
    title: "お題を1つ入れるだけ",
    body: "話したいことを入れるか、おすすめのお題から選びます。",
  },
  {
    image: "expand",
    title: "話題が 8 方向に広がる",
    body: "気になったカードから、さらに次の 8 つへ広げていけます。",
  },
  {
    image: "menu",
    title: "残す・作り直す・メモする",
    body: "使いたい話題はピン、合わなければ作り直し、付箋でひとこと。",
  },
  {
    image: "combine",
    title: "2つを掛け合わせる",
    body: "「ゲーム × 料理」のように、組み合わせから意外な話題を作れます。",
  },
  {
    image: "detail",
    title: "具体的に掘り下げる",
    body: "エピソード・答え・対応策など、そのまま話せる中身まで出せます。",
  },
] as const;

/** 使い方の画像を 1 枚ずつ見る（◀ ▶・下の点・スワイプで切り替え） */
export function UsageGallery({ className }: { className?: string }) {
  const trackRef = useRef<HTMLOListElement>(null);
  const [index, setIndex] = useState(0);
  const last = USAGE_STEPS.length - 1;

  const go = (next: number) => {
    const track = trackRef.current;
    const target = Math.max(0, Math.min(last, next));
    setIndex(target);
    track?.scrollTo({ left: target * track.clientWidth, behavior: "smooth" });
  };

  return (
    <div
      className={cn("usage-gallery", className)}
      role="region"
      aria-roledescription="スライド"
      aria-label="できること"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") go(index - 1);
        if (event.key === "ArrowRight") go(index + 1);
      }}
    >
      <div className="usage-gallery-frame">
        <ol
          ref={trackRef}
          className="usage-gallery-track"
          onScroll={(event) => {
            const track = event.currentTarget;
            if (track.clientWidth > 0) setIndex(Math.round(track.scrollLeft / track.clientWidth));
          }}
        >
          {USAGE_STEPS.map((step, i) => (
            <li key={step.image} className="usage-gallery-item" aria-hidden={i !== index}>
              {/* eslint-disable-next-line @next/next/no-img-element -- 静的エクスポートでも同じパスで出すため */}
              <img
                src={`${base}/guide/${step.image}.webp`}
                alt={`${step.title}の画面`}
                width={1200}
                height={750}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                className="usage-gallery-img"
              />
              <p className="usage-gallery-title">{step.title}</p>
              <p className="usage-gallery-body">{step.body}</p>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="usage-gallery-arrow"
          data-side="prev"
          aria-label="前へ"
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          <ChevronLeft aria-hidden />
        </button>
        <button
          type="button"
          className="usage-gallery-arrow"
          data-side="next"
          aria-label="次へ"
          disabled={index === last}
          onClick={() => go(index + 1)}
        >
          <ChevronRight aria-hidden />
        </button>
      </div>
      <div className="usage-gallery-dots">
        {USAGE_STEPS.map((step, i) => (
          <button
            key={step.image}
            type="button"
            className="usage-gallery-dot"
            aria-label={`${i + 1}枚目: ${step.title}`}
            aria-current={i === index}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </div>
  );
}
