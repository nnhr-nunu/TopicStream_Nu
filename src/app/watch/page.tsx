import { Suspense } from "react";

import { WatchPageClient } from "@/components/watch-page-client";

export default function WatchPage() {
  return (
    <main className="h-svh overflow-hidden">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            いっしょに見る画面を準備中…
          </div>
        }
      >
        <WatchPageClient />
      </Suspense>
    </main>
  );
}
