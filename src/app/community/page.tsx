import { SEED_CATALOG } from "@/lib/catalog-data";

import { AdScript } from "@/components/ad-script";
import { CommunityCatalog } from "@/components/community-catalog";

export default function CommunityPage() {
  return (
    <>
      <AdScript />
      <CommunityCatalog initialBoards={SEED_CATALOG} />
    </>
  );
}
