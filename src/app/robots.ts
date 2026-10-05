import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-static";

/**
 * API とオーバーレイは読ませない。いっしょに見るは X などが共有カードを作れるよう読ませる（ページの noindex で検索には出さない）。
 * キー無しデモ（GitHub Pages）は丸ごと noindex なので、sitemap を載せない
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return {
    rules: { userAgent: "*", allow: "/", disallow: [`${base}/api/`, `${base}/overlay`] },
    ...(process.env.STATIC_EXPORT === "1" ? {} : { sitemap: `${siteUrl()}${base}/sitemap.xml` }),
  };
}
