"use client";

import { createContext, useContext } from "react";
import { X } from "lucide-react";

/**
 * 掛け合わせ（カードを別のカードに重ねる）の状態。キャンバスが持ち、カードから呼ぶ。
 * - PC: React Flow のドラッグ（キャンバス側で処理）
 * - スマホ: 長押しでカードを持ち上げてから動かす（ふつうに触って動かすと盤面のスクロール）
 * - メニューの「掛け合わせる」: 相手のカードをタップで選ぶ
 */
export type CombineApi = {
  /** メニューから選んでいる途中の、持ってきた側のカード */
  pickFrom: string | null;
  startPick: (id: string) => void;
  cancelPick: () => void;
  /** 選んでいる途中なら相手として受け取り true を返す */
  pickTarget: (id: string) => boolean;
  /** ドラッグを離した直後のクリック（元の位置でのタップ扱い）を無視するため */
  justDropped: () => boolean;
  touchStart: (id: string, label: string, x: number, y: number) => void;
  touchMove: (x: number, y: number) => void;
  touchEnd: (x: number, y: number) => void;
  touchCancel: () => void;
};

const CombineContext = createContext<CombineApi | null>(null);

export const CombineProvider = CombineContext.Provider;

/** オーバーレイ・見るだけの画面では null（掛け合わせない） */
export function useCombine(): CombineApi | null {
  return useContext(CombineContext);
}

/** 画面上の点の下にあるカード（exclude 以外）の id */
export function nodeIdAt(x: number, y: number, exclude: string): string | null {
  if (typeof document === "undefined") return null;
  for (const element of document.elementsFromPoint(x, y)) {
    const node = element.closest<HTMLElement>(".react-flow__node");
    const id = node?.dataset.id;
    if (id && id !== exclude && !node.querySelector(".topic-chip-skeleton")) return id;
  }
  return null;
}

/** スマホで持ち上げたカード。指で隠れないよう、指の少し上に出す */
export function CombineGhost({ label, x, y, over }: { label: string; x: number; y: number; over: boolean }) {
  return (
    <div className="combine-ghost" style={{ left: x, top: y }} aria-hidden>
      <span className="combine-ghost-label">{label}</span>
      <span className="combine-ghost-hint">{over ? "離すと掛け合わせ" : "別のカードに重ねる"}</span>
    </div>
  );
}

export function CombinePickBanner({ label, onCancel }: { label: string; onCancel: () => void }) {
  return (
    <div className="combine-pick-banner" role="status">
      <span className="min-w-0 truncate">
        「{label}」と<b>掛け合わせる相手</b>のカードをタップ
      </span>
      <button type="button" className="combine-pick-cancel" onClick={onCancel}>
        <X className="size-4" aria-hidden />
        やめる
      </button>
    </div>
  );
}
