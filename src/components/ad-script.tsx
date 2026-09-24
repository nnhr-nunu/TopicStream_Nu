import { adConfig, adScriptSrc } from "@/lib/ads";

/**
 * AdSense の読み込みタグ。広告を出すページ（ホーム・みんなのトークテーマ・使い方）にだけ置く。
 * 配信画面（オーバーレイ・いっしょに見る）には置かない。ID 未設定なら何も出さない。
 */
export function AdScript() {
  if (!adConfig.client) return null;
  return <script async src={adScriptSrc(adConfig.client)} crossOrigin="anonymous" />;
}
