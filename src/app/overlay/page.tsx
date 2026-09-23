import { Suspense } from "react";

import { OverlayWorkspace } from "@/components/overlay-workspace";

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
