import type { ResolvingMetadata } from "next";

import { AdScript } from "@/components/ad-script";
import { CommunityCatalog } from "@/components/community-catalog";
import { pageMetadata } from "@/lib/page-metadata";

export function generateMetadata(_: unknown, parent: ResolvingMetadata) {
  return pageMetadata(parent, {
    path: "/community",
    title: "みんなが作った話題マップ | TopicStream(ぬ)",
    description:
      "みんなが TopicStream(ぬ)で作って広げた話題マップの一覧。よく使われた順に並び、気になるマップを開いて、広げたところから自分のマップとして続けられます。",
  });
}

export default function CommunityPage() {
  return (
    <>
      <AdScript />
      <CommunityCatalog />
    </>
  );
}
