"use client";

import { toast } from "sonner";

import { cn } from "@/lib/utils";

/** 配信のチャットや概要欄に貼る、視聴者向けの案内 */
export const VIEWER_GUIDE_TEXT =
  "【コメントで参加できます】カードの番号（例: 1E）を書くとカードが光ります／「1E ❤」でハート／「お題:〇〇」で話してほしいお題を送れます";

export async function copyViewerGuide() {
  try {
    await navigator.clipboard.writeText(VIEWER_GUIDE_TEXT);
    toast.success("視聴者への案内をコピーしました", { description: "チャットや概要欄に貼れます。" });
  } catch {
    toast.error("コピーできませんでした");
  }
}

/** 視聴者がコメントでできること（配信と連携したとき・コメント欄で見せる） */
export function ViewerGuide({ className }: { className?: string }) {
  return (
    <ul className={cn("viewer-guide", className)}>
      <li>
        <code>1E</code>
        <span>そのカードが光る</span>
      </li>
      <li>
        <code>1E ❤</code>
        <span>カードにハート（❤ だけなら NOW のカード）</span>
      </li>
      <li>
        <code>お題:〇〇</code>
        <span>お題箱に入る。押すとカードになって広がる</span>
      </li>
    </ul>
  );
}
