import { WatchView } from "@/components/watch-view";

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="h-svh overflow-hidden">
      <WatchView shareId={id} />
    </main>
  );
}
