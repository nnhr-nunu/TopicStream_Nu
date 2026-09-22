"use client";

import { useSearchParams } from "next/navigation";

import { WatchView } from "@/components/watch-view";

export function WatchPageClient() {
  const searchParams = useSearchParams();
  const shareId = searchParams.get("id")?.trim() ?? "";
  return <WatchView shareId={shareId} />;
}
