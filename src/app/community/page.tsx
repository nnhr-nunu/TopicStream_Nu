import { SEED_CATALOG } from "@/lib/catalog-data";

import { CommunityCatalog } from "@/components/community-catalog";

export default function CommunityPage() {
  return <CommunityCatalog initialBoards={SEED_CATALOG} />;
}
