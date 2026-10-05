import type { Metadata, ResolvingMetadata } from "next";

import { canonicalUrl } from "@/lib/site-url";

export const SITE_TITLE = "TopicStream(ぬ) | 話題が広がるマインドマップ・マンダラートWebサービス";
export const SITE_DESCRIPTION =
  "お題をひとつ入れると、話せるネタや考えの切り口を 8 方向に広げるマインドマップ・マンダラート。雑談配信のネタ出しから、お悩み相談・アイデア出し・目標の分解・振り返り・調べものまで。登録不要・無料。";
/** トップを共有したときのカードの見出し */
export const SHARE_TITLE = "TopicStream(ぬ) | もう、話題に詰まらない。";

type PageMeta = {
  /** 末尾の / なし。トップは "" */
  path: string;
  /** 省くとルートの layout の title のまま */
  title?: string;
  description: string;
  /** 共有カードの見出し。省くと title と同じ */
  shareTitle?: string;
  type?: "website" | "article";
};

/**
 * 検索に出すページの title・canonical・共有カード（OGP / X）。
 * openGraph を書き直すと共有カードの画像（opengraph-image.png）が外れるので、親のものを引き継ぐ
 */
export async function pageMetadata(parent: ResolvingMetadata, page: PageMeta): Promise<Metadata> {
  const inherited = await parent;
  const url = canonicalUrl(page.path);
  const shareTitle = page.shareTitle ?? page.title;
  return {
    ...(page.title ? { title: page.title } : {}),
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      type: page.type ?? "website",
      siteName: "TopicStream(ぬ)",
      locale: "ja_JP",
      title: shareTitle,
      description: page.description,
      url,
      images: inherited.openGraph?.images,
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description: page.description,
      images: inherited.twitter?.images,
    },
  };
}
