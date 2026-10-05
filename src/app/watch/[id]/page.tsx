import type { Metadata } from "next";

import { WatchView } from "@/components/watch-view";

/** 配信ごとの画面なので検索には出さない（robots.txt でもクロールを止めている） */
export const metadata: Metadata = {
  title: "いっしょに見る | TopicStream(ぬ)",
  robots: { index: false, follow: false },
};

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="h-svh overflow-hidden">
      <WatchView shareId={id} />
    </main>
  );
}
