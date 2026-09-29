/**
 * 公開先のオリジン（共有カードの画像・sitemap の絶対 URL に使う）。NEXT_PUBLIC_SITE_URL で上書きできる。
 * 静的エクスポート（GitHub Pages のキー無しデモ）と、Vercel の本番（独自ドメイン）で既定を変える。
 * basePath はここに含めない（Next が画像の URL に付ける）
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return process.env.STATIC_EXPORT === "1" ? "https://nnhr-nunu.github.io" : "https://topic-stream.oshilog.life";
}
