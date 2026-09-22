import { listCatalog } from "@/lib/live-store";

import { CommunityCatalog } from "@/components/community-catalog";

export default function CommunityPage() {
  const boards = listCatalog();
  return <CommunityCatalog initialBoards={boards} />;
}
