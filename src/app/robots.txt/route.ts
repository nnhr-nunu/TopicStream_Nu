import { aiRobotsTxt } from "@/lib/aiGuard";
import { siteUrl } from "@/lib/site-url";

// 静的エクスポート（GitHub Pages）でもビルド時に out/robots.txt を書き出す
export const dynamic = "force-static";

/**
 * AI の学習のボットは全部止め（aiGuard.ts）、ほかは API とオーバーレイを読ませない。
 * いっしょに見るは X などが共有カードを作れるよう読ませる（ページの noindex で検索には出さない）。
 * キー無しデモ（GitHub Pages）は丸ごと noindex なので、sitemap を載せない
 */
export function GET() {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const body = aiRobotsTxt({
    rules: ["Allow: /", `Disallow: ${base}/api/`, `Disallow: ${base}/overlay`],
    ...(process.env.STATIC_EXPORT === "1" ? {} : { sitemap: `${siteUrl()}${base}/sitemap.xml` }),
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
