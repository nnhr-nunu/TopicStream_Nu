import { listCatalog, popularTopics } from "@/lib/live-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  return Response.json({
    boards: listCatalog(query),
    popular: popularTopics(),
  });
}
