import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-static";

/** 検索に出すのは入口のページだけ。配信用の画面（いっしょに見る・オーバーレイ）と API は載せない */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return {
    rules: { userAgent: "*", allow: "/", disallow: [`${base}/api/`, `${base}/watch`, `${base}/overlay`] },
    sitemap: `${siteUrl()}${base}/sitemap.xml`,
  };
}
