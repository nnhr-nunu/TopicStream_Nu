import {
  knowledgeBackend,
  loadSharedFor,
  loadSharedKnowledge,
  recordSharedPicks,
  type SharedPick,
} from "@/lib/knowledge-server";
import { clientKeyFromHeaders } from "@/lib/gemini-guard";
import { isBoardMode, parseMode } from "@/lib/modes";
import { createRateLimit, readJsonBody, tooManyRequests } from "@/lib/rate-limit";
import { isCategoryId, isPickKind, knowledgeCounts, relatedEntries, searchKnowledge } from "@/lib/topic-knowledge";

/**
 * みんなの図鑑の口。
 * - GET ?seed=お題&mode=モード … そのお題と似たお題（カードの候補に使う。同じモードの中だけ）
 * - GET ?q=検索語&category=分類&mode=モード … 図鑑ページの検索（空なら人気順。mode を省くと雑談）
 * - POST { picks: [{ seed, topic, kind, mode? }] } … 語が選ばれた（♡・クリック・ピン・書き直し・コメントのハート）。
 *   図鑑に無い語でもそのまま加える（データ集め優先）
 * AI の結果は /api/gemini と /api/knowledge/grow が記録する。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const seed = searchParams.get("seed")?.trim().slice(0, 80);
  const mode = parseMode(searchParams.get("mode"));
  const headers = { "Cache-Control": "public, max-age=60, s-maxage=120" };

  if (seed) {
    const shared = await loadSharedFor(seed, mode);
    const entries = relatedEntries(shared, seed, 8, mode).map((item) => item.entry);
    return Response.json({ entries, backend: knowledgeBackend() }, { headers });
  }

  const shared = await loadSharedKnowledge();
  const category = searchParams.get("category");
  const hits = searchKnowledge(
    shared,
    (searchParams.get("q") ?? "").slice(0, 80),
    isCategoryId(category) ? category : "all",
    80,
    mode,
  );
  return Response.json(
    {
      entries: hits.map((hit) => hit.entry),
      total: Object.keys(shared).length,
      // 返すのは検索に合った分だけなので、タグの横の数は図鑑全体から数えて別に返す
      counts: knowledgeCounts(shared, mode),
      backend: knowledgeBackend(),
    },
    { headers },
  );
}

/** 1回に受け付ける票の数（画面は数秒ごとにまとめて送る） */
const MAX_BATCH = 100;
/** 1 人（IP）が 1 時間に入れられる票の数（ふつうに使えば届かない。荒らしで図鑑を塗り替えられないように） */
const perHour = createRateLimit(600, 60 * 60_000);
const perMinute = createRateLimit(40, 60_000);

type RawPick = { seed?: unknown; topic?: unknown; kind?: unknown; mode?: unknown };

function asPick(raw: RawPick): SharedPick | null {
  if (typeof raw?.seed !== "string" || typeof raw.topic !== "string" || !isPickKind(raw.kind)) return null;
  return {
    seed: raw.seed.slice(0, 80),
    topic: raw.topic.slice(0, 80),
    kind: raw.kind,
    ...(isBoardMode(raw.mode) ? { mode: raw.mode } : {}),
  };
}

export async function POST(request: Request) {
  const client = clientKeyFromHeaders(request.headers);
  if (!perMinute(client)) return tooManyRequests(30);
  const body = await readJsonBody<{ picks?: unknown } & RawPick>(request, 64_000);
  const raw: RawPick[] = Array.isArray(body?.picks) ? (body.picks as RawPick[]) : body ? [body] : [];
  // 同じ語への同じ種類の票は、1 回の送信で 1 つに数える
  const seen = new Set<string>();
  const picks = raw
    .slice(0, MAX_BATCH)
    .map(asPick)
    .filter((pick): pick is SharedPick => {
      if (!pick) return false;
      const key = `${pick.mode ?? "chat"}|${pick.seed}|${pick.topic}|${pick.kind}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (picks.length === 0) return Response.json({ ok: false }, { status: 400 });
  if (!perHour(client, picks.length)) return tooManyRequests(10 * 60);
  const recorded = await recordSharedPicks(picks);
  return Response.json({ ok: true, recorded });
}
