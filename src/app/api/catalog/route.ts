import { listCommunityCatalog } from "@/lib/community-server";
import { listCatalog, popularTopics } from "@/lib/live-store";

/**
 * 検索なしの一覧はホームを開くたびに読まれ、全ボードのカードが入っていて重い。
 * サーバー側でも 1 分おきにしか読み直さないので、CDN に短く持たせる（検索つきは持たせない）
 */
const LIST_CACHE = "public, max-age=0, s-maxage=30, stale-while-revalidate=300";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  return Response.json(
    {
      boards: [...listCatalog(query), ...(await listCommunityCatalog(query))],
      popular: popularTopics(),
    },
    query ? undefined : { headers: { "Cache-Control": LIST_CACHE } },
  );
}
