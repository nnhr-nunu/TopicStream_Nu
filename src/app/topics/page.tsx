import type { ResolvingMetadata } from "next";

import { AdScript } from "@/components/ad-script";
import { TopicDatabase } from "@/components/topic-database";
import { TopicPageIndex } from "@/components/topic-page-index";
import { pageMetadata } from "@/lib/page-metadata";

export function generateMetadata(_: unknown, parent: ResolvingMetadata) {
  return pageMetadata(parent, {
    path: "/topics",
    title: "雑談配信のトークテーマ・ネタ一覧 | TopicStream(ぬ)",
    description:
      "雑談配信のネタ一覧。みんなが TopicStream(ぬ)で広げた話題を、お題ごとにまとめたトピック図鑑です。お題や話題で検索して、そのまま自分のマップにできます。",
  });
}

export default function TopicsPage() {
  return (
    <>
      <AdScript />
      <TopicDatabase>
        <TopicPageIndex />
      </TopicDatabase>
    </>
  );
}
