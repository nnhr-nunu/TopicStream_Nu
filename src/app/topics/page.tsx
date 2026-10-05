import type { ResolvingMetadata } from "next";

import { AdScript } from "@/components/ad-script";
import { TopicDatabase } from "@/components/topic-database";
import { TopicPageIndex } from "@/components/topic-page-index";
import { pageMetadata } from "@/lib/page-metadata";

export function generateMetadata(_: unknown, parent: ResolvingMetadata) {
  return pageMetadata(parent, {
    path: "/topics",
    title: "トピック図鑑 | TopicStream(ぬ)",
    description:
      "みんなが TopicStream(ぬ)で広げた雑談ネタを、お題ごとにまとめた図鑑。お題や話題で検索して、そのまま自分のマップにできます。",
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
