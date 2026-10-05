import type { Metadata, ResolvingMetadata } from "next";

import { canonicalUrl } from "@/lib/site-url";

export const SITE_TITLE = "TopicStream(ぬ) | 話題が広がるマインドマップ・マンダラートWebサービス";
export const SITE_DESCRIPTION =
  "雑談配信のネタ切れやトークテーマ探しに。お題をひとつ入れると、話せるネタや考えの切り口を 8 方向に広げるマインドマップ・マンダラート。お悩み相談・アイデア出し・目標の分解・振り返り・調べものにも。登録不要・無料。";
/** トップを共有したときのカードの見出し */
export const SHARE_TITLE = "TopicStream(ぬ) | もう、話題に詰まらない。";

/**
 * キー無しデモ（GitHub Pages）は丸ごと検索に出さない（同じページの古い版が本番と並ばないように）。
 * noindex と canonical を両方付けると食い違うので、デモでは canonical を付けない
 */
const DEMO_BUILD = process.env.STATIC_EXPORT === "1";
export const SITE_ROBOTS: Metadata["robots"] = DEMO_BUILD ? { index: false, follow: true } : undefined;
const NOINDEX: Metadata["robots"] = { index: false, follow: false };

type PageMeta = {
  /** 末尾の / なし。トップは "" */
  path: string;
  /** 省くとルートの layout の title のまま */
  title?: string;
  description: string;
  /** 共有カードの見出し。省くと title と同じ */
  shareTitle?: string;
  type?: "website" | "article";
  /** 配信ごとの画面など、共有カードは出すが検索には出さない */
  noindex?: boolean;
};

/**
 * ページの title・canonical・共有カード（OGP / X）。
 * openGraph を書き直すと共有カードの画像（opengraph-image.png）が外れるので、親のものを引き継ぐ
 */
export async function pageMetadata(parent: ResolvingMetadata, page: PageMeta): Promise<Metadata> {
  const inherited = await parent;
  const url = canonicalUrl(page.path);
  const shareTitle = page.shareTitle ?? page.title;
  return {
    ...(page.title ? { title: page.title } : {}),
    description: page.description,
    ...(page.noindex ? { robots: NOINDEX } : DEMO_BUILD ? {} : { alternates: { canonical: url } }),
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

/** 配信ごとの画面（いっしょに見る・オーバーレイ）。検索には出さない */
export function streamPageMetadata(name: string): Metadata {
  return { title: `${name} | TopicStream(ぬ)`, robots: NOINDEX };
}
