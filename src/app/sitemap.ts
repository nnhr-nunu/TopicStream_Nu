import type { MetadataRoute } from "next";

import { pageUrl } from "@/lib/site-url";
import { topicPages } from "@/lib/topic-pages";

// 静的エクスポート（GitHub Pages）でもビルド時に書き出す
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "/", priority: 1 },
    { path: "/topics", priority: 0.8 },
    { path: "/community", priority: 0.6 },
    { path: "/guide", priority: 0.6 },
    { path: "/privacy", priority: 0.2 },
    // お題ごとのページ（検索から来る人の入口）
    ...topicPages().map((page) => ({ path: `/topics/${page.slug}`, priority: 0.7 })),
  ];
  return pages.map(({ path, priority }) => ({ url: pageUrl(path), changeFrequency: "weekly", priority }));
}
