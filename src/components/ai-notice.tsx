import type { CSSProperties } from "react";

import { AI_NOTICE_EN, AI_NOTICE_JA, AI_NOTICE_STYLE, TRAP_PATH } from "@/lib/aiGuard";

/** CSS の宣言の文字列（"a-b:c;d:e"）を React の style オブジェクトにする */
function cssToStyle(css: string): CSSProperties {
  const style: Record<string, string> = {};
  for (const declaration of css.split(";")) {
    const at = declaration.indexOf(":");
    if (at < 0) continue;
    const name = declaration.slice(0, at).trim().replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
    style[name] = declaration.slice(at + 1).trim();
  }
  return style as CSSProperties;
}

/**
 * AI 向けの案内とおとりの道へのリンク（正本は aiGuard.ts）。人の目・読み上げ・検索の抜粋には出さない。
 * display:none にしない（文字の取り出しにも出なくなる）。
 * body は flex の入れ物なので、position:absolute の案内は先頭（左上）に置かれ、配信ソフトのオーバーレイ（高さぴったりの画面）に
 * スクロールを出さない
 */
const NOTICE_STYLE = cssToStyle(AI_NOTICE_STYLE);

export function AiNotice() {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return (
    <div aria-hidden="true" data-nosnippet style={NOTICE_STYLE}>
      <p>{AI_NOTICE_JA}</p>
      <p lang="en">{AI_NOTICE_EN}</p>
      <a href={`${base}${TRAP_PATH}`} rel="nofollow" tabIndex={-1}>
        archive
      </a>
    </div>
  );
}
