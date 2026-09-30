/**
 * 公開先のオリジン（共有カードの画像・sitemap の絶対 URL に使う）。NEXT_PUBLIC_SITE_URL で上書きできる。
 * 静的エクスポート（GitHub Pages のキー無しデモ）と、Vercel の本番（独自ドメイン）で既定を変える。
 * basePath はここに含めない（Next が画像の URL に付ける）
 */
const PRODUCTION_URL = "https://topic-stream.oshilog.life";

/**
 * 検索エンジンに伝える「このページの正しい場所」。path は末尾の / なし（例: /topics/abc）。
 * キー無しデモ（GitHub Pages）にも同じページが出るので、そちらは本番の URL を指して、検索の評価が2つに割れないようにする
 */
export function canonicalUrl(path: string): string {
  return `${process.env.STATIC_EXPORT === "1" ? PRODUCTION_URL : siteUrl()}${path}`;
}

/** この公開先でのページの URL（sitemap 用）。静的エクスポートは末尾に / が付く */
export function pageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const slash = process.env.STATIC_EXPORT === "1" && !path.endsWith("/") ? "/" : "";
  return `${siteUrl()}${base}${path}${slash}`;
}

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return process.env.STATIC_EXPORT === "1" ? "https://nnhr-nunu.github.io" : PRODUCTION_URL;
}
