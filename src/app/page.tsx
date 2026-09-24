import { AdScript } from "@/components/ad-script";
import { TopicWorkspace } from "@/components/topic-workspace";

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
