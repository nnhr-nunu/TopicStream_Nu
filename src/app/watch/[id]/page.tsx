import { WatchView } from "@/components/watch-view";
import { streamPageMetadata } from "@/lib/page-metadata";

export const metadata = streamPageMetadata("いっしょに見る");

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="h-svh overflow-hidden">
      <WatchView shareId={id} />
    </main>
  );
}
