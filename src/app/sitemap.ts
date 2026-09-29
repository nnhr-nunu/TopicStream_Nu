import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

// 静的エクスポート（GitHub Pages）でもビルド時に書き出す
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = `${siteUrl()}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}`;
  const pages = [
    { path: "/", priority: 1 },
    { path: "/topics/", priority: 0.8 },
    { path: "/community/", priority: 0.6 },
    { path: "/guide/", priority: 0.6 },
    { path: "/privacy/", priority: 0.2 },
  ];
  return pages.map(({ path, priority }) => ({ url: `${base}${path}`, changeFrequency: "weekly", priority }));
}
