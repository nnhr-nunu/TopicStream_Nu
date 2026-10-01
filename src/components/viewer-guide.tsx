"use client";

import { toast } from "sonner";

import { watchLinkFromSession } from "@/hooks/use-watch-share";
import { cn } from "@/lib/utils";

/** 配信のチャットや概要欄に貼る、視聴者向けの案内 */
export const VIEWER_GUIDE_TEXT =
  "【コメントで参加できます】カードの番号（例: 1E）を書くと、そのカードが光ってハート +1／「❤」だけなら今の話題にハート／「お題:〇〇」で話してほしいお題を送れます";

export async function copyViewerGuide() {
  // いっしょに見るリンクを作ってあれば、盤面のリンクも 1 回の貼り付けで渡せるように付ける
  const watch = watchLinkFromSession();
  try {
    await navigator.clipboard.writeText(watch ? `${VIEWER_GUIDE_TEXT}／盤面はこちら: ${watch}` : VIEWER_GUIDE_TEXT);
    toast.success("視聴者への案内をコピーしました", {
      description: watch ? "いっしょに見るリンクも付けました。チャットや概要欄に貼れます。" : "チャットや概要欄に貼れます。",
    });
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
        <span>そのカードが光って、ハート +1</span>
      </li>
      <li>
        <code>❤</code>
        <span>NOW のカードにハート</span>
      </li>
      <li>
        <code>お題:〇〇</code>
        <span>お題箱に届く。押すとカードになって NOW に</span>
      </li>
    </ul>
  );
}
