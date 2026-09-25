import type { Metadata } from "next";

import { AdScript } from "@/components/ad-script";
import { TopicDatabase } from "@/components/topic-database";

export const metadata: Metadata = {
  title: "トピック図鑑 | TopicStream(ぬ)",
  description:
    "みんなが TopicStream(ぬ)で広げた雑談ネタを、お題ごとにまとめた図鑑。お題や話題で検索して、そのままボードにできます。",
};

export default function TopicsPage() {
  return (
    <>
      <AdScript />
      <TopicDatabase />
    </>
  );
}
