import type { Metadata, ResolvingMetadata } from "next";

import { WatchView } from "@/components/watch-view";
import { getShare } from "@/lib/live-store";
import { pageMetadata, streamPageMetadata } from "@/lib/page-metadata";

type Props = { params: Promise<{ id: string }> };

/** X などに貼ったときのカードに、マップの名前と配信者名を出す。検索には出さない */
export async function generateMetadata({ params }: Props, parent: ResolvingMetadata): Promise<Metadata> {
  const { id } = await params;
  const share = await getShare(id).catch(() => null);
  if (!share?.board.name) return streamPageMetadata("いっしょに見る");
  const name = share.board.name;
  const owner = share.nickname ? `${share.nickname} の枠で` : "配信で";
  return pageMetadata(parent, {
    path: `/watch/${id}`,
    title: `${name} | いっしょに見る - TopicStream(ぬ)`,
    description: `${owner}使っている話題マップ「${name}」。いま話している話題（NOW）を、配信といっしょに見られます。`,
    noindex: true,
  });
}

export default async function WatchPage({ params }: Props) {
  const { id } = await params;
  return (
    <main className="h-svh overflow-hidden">
      <WatchView shareId={id} />
    </main>
  );
}
