import { isPublicEntry, knowledgeBackend, loadSharedKnowledge } from "@/lib/knowledge-server";
import { isCategoryId, relatedEntries, searchKnowledge, type KnowledgeStore } from "@/lib/topic-knowledge";

/**
 * みんなの図鑑を読むだけの口。
 * - ?seed=お題 … そのお題と似たお題（カードの候補に使う）
 * - ?q=検索語&category=分類 … 図鑑ページの検索（空なら人気順）
 * 書き込みは /api/gemini が AI の結果をそのまま記録するだけ。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shared = await loadSharedKnowledge();
  const seed = searchParams.get("seed")?.trim().slice(0, 80);
  const headers = { "Cache-Control": "public, max-age=60, s-maxage=120" };

  if (seed) {
    // 本人が入れたお題そのものは返してよい。似たお題は一覧に出せるものだけ
    const entries = relatedEntries(shared, seed, 8)
      .filter((item) => item.exact || isPublicEntry(item.entry))
      .map((item) => item.entry);
    return Response.json({ entries, backend: knowledgeBackend() }, { headers });
  }

  const publicStore: KnowledgeStore = Object.fromEntries(
    Object.entries(shared).filter(([, entry]) => isPublicEntry(entry)),
  );
  const category = searchParams.get("category");
  const hits = searchKnowledge(
    publicStore,
    (searchParams.get("q") ?? "").slice(0, 80),
    isCategoryId(category) ? category : "all",
    80,
  );
  return Response.json(
    { entries: hits.map((hit) => hit.entry), total: Object.keys(publicStore).length, backend: knowledgeBackend() },
    { headers },
  );
}
