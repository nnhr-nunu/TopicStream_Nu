import type { Metadata } from "next";
import { Suspense } from "react";

import { OverlayWorkspace } from "@/components/overlay-workspace";

/** 配信ごとの画面なので検索には出さない（robots.txt でもクロールを止めている） */
export const metadata: Metadata = {
  title: "オーバーレイ | TopicStream(ぬ)",
  robots: { index: false, follow: false },
};

export default function OverlayPage() {
  return (
    <main className="h-svh overflow-hidden">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-lg text-muted-foreground">
            オーバーレイを準備中…
          </div>
        }
      >
        <OverlayWorkspace />
      </Suspense>
    </main>
  );
}
