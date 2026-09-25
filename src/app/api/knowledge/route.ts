import { clientKeyFromHeaders } from "@/lib/gemini-guard";
import { knowledgeBackend, loadSharedFor, loadSharedKnowledge, recordSharedPick } from "@/lib/knowledge-server";
import { isCategoryId, isPickKind, relatedEntries, searchKnowledge } from "@/lib/topic-knowledge";

/**
 * みんなの図鑑の口。
 * - GET ?seed=お題 … そのお題と似たお題（カードの候補に使う）
 * - GET ?q=検索語&category=分類 … 図鑑ページの検索（空なら人気順）
 * - POST { seed, topic, kind } … 図鑑にある語が選ばれた（♡・クリック・ピンなど）。新しい文言は入れられない
 * 新しい語の記録は /api/gemini と /api/knowledge/grow が AI の結果をそのまま入れるだけ。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const seed = searchParams.get("seed")?.trim().slice(0, 80);
  const headers = { "Cache-Control": "public, max-age=60, s-maxage=120" };

  if (seed) {
    const shared = await loadSharedFor(seed);
    const entries = relatedEntries(shared, seed, 8).map((item) => item.entry);
    return Response.json({ entries, backend: knowledgeBackend() }, { headers });
  }

  const shared = await loadSharedKnowledge();
  const category = searchParams.get("category");
  const hits = searchKnowledge(
    shared,
    (searchParams.get("q") ?? "").slice(0, 80),
    isCategoryId(category) ? category : "all",
    80,
  );
  return Response.json(
    { entries: hits.map((hit) => hit.entry), total: Object.keys(shared).length, backend: knowledgeBackend() },
    { headers },
  );
}

/** 1人あたり1分に受け付ける票の数（インスタンスごと・連打で順位を動かしにくくする） */
const PICKS_PER_MINUTE = 30;
const recentPicks = new Map<string, number[]>();

function allowPick(clientKey: string): boolean {
  const now = Date.now();
  const times = (recentPicks.get(clientKey) ?? []).filter((time) => now - time < 60_000);
  if (times.length >= PICKS_PER_MINUTE) return false;
  times.push(now);
  recentPicks.set(clientKey, times);
  if (recentPicks.size > 5_000) recentPicks.clear();
  return true;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { seed?: unknown; topic?: unknown; kind?: unknown } | null;
  const seed = typeof body?.seed === "string" ? body.seed.trim().slice(0, 80) : "";
  const topic = typeof body?.topic === "string" ? body.topic.trim().slice(0, 40) : "";
  if (!seed || !topic || !isPickKind(body?.kind)) return Response.json({ ok: false }, { status: 400 });
  if (!allowPick(clientKeyFromHeaders(request.headers))) return Response.json({ ok: false }, { status: 429 });
  const ok = await recordSharedPick(seed, topic, body.kind);
  return Response.json({ ok });
}
