import type { ResolvingMetadata } from "next";

import { AdScript } from "@/components/ad-script";
import { TopicWorkspace } from "@/components/topic-workspace";
import { pageMetadata, SHARE_TITLE, SITE_DESCRIPTION } from "@/lib/page-metadata";

export function generateMetadata(_: unknown, parent: ResolvingMetadata) {
  return pageMetadata(parent, { path: "", description: SITE_DESCRIPTION, shareTitle: SHARE_TITLE });
}

export default function HomePage() {
  return (
    <>
      <AdScript />
      <main className="h-svh overflow-hidden">
        <TopicWorkspace />
      </main>
    </>
  );
}
