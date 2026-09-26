import { DEFAULT_MODEL } from "@/lib/constants";
import { readGeminiApiKey, sanitizeSecret } from "@/lib/env-secret";
import { geminiUserNotice, requestGemini } from "@/lib/gemini-core";
import { pickGrowCandidates } from "@/lib/knowledge-grow";
import { loadSharedKnowledge, recordSharedKnowledge } from "@/lib/knowledge-server";
import { seedKnowledge } from "@/lib/topic-knowledge-seed";

/**
 * みんなの図鑑を AI で育てる。Vercel Cron が1日1回呼ぶ（vercel.json）。
 * Gemini の1日の枠は太平洋時間の0時（日本時間16〜17時）に戻るので、その直前に「その日の余り」を使う。
 * 上限（quota）に当たったらその場でやめる＝配信中の利用者の分は取らない。
 *
 * 呼べるのは Authorization: Bearer <CRON_SECRET> を付けたときだけ（Vercel Cron は自動で付ける）。
 * 公開前にまとめて育てるときは ?limit=40 のように数を指定して手で呼ぶ。
 */
export const maxDuration = 60;

/** 1回の実行で頼むお題の数の既定（GROW_LIMIT で変えられる） */
const DEFAULT_LIMIT = 20;
/** 1つ頼むのに最大 24 秒かかることがあるので、残りがこれを切ったら次は頼まない */
const TIME_BUDGET_MS = 52_000;
const MIN_REMAINING_MS = 14_000;

export async function GET(request: Request) {
  const secret = sanitizeSecret(process.env.CRON_SECRET);
  if (!secret) {
    return Response.json({ ok: false, error: "CRON_SECRET が未設定です" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const apiKey = readGeminiApiKey();
  if (!apiKey) return Response.json({ ok: false, error: "GEMINI_API_KEY が未設定です" }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const envLimit = Number(process.env.GROW_LIMIT) || DEFAULT_LIMIT;
  const limit = Math.max(1, Math.min(60, Number(searchParams.get("limit")) || envLimit));
  const started = Date.now();
  // お悩み相談などもそのモードの指示で育てる（雑談の指示で広げると的外れになるため、モードごとに頼む）
  const candidates = pickGrowCandidates(seedKnowledge(), await loadSharedKnowledge(), limit);

  const grown: { seed: string; mode: string; added: number }[] = [];
  let stopped: string | null = null;
  let failures = 0;
  for (const candidate of candidates) {
    if (TIME_BUDGET_MS - (Date.now() - started) < MIN_REMAINING_MS) {
      stopped = "time";
      break;
    }
    try {
      const result = await requestGemini({
        seed: candidate.seed,
        existing: [candidate.seed, ...candidate.known.slice(0, 40)],
        apiKey,
        model: DEFAULT_MODEL,
        count: 12,
        mode: candidate.mode,
      });
      await recordSharedKnowledge(candidate.seed, result.topics, candidate.mode);
      grown.push({ seed: candidate.seed, mode: candidate.mode, added: result.topics.length });
      failures = 0;
    } catch (error) {
      const notice = geminiUserNotice(error);
      if (notice.kind === "quota") {
        stopped = "quota";
        break;
      }
      failures += 1;
      if (failures >= 3) {
        stopped = notice.kind;
        break;
      }
    }
  }

  console.info("[knowledge-grow]", JSON.stringify({ grown: grown.length, stopped, ms: Date.now() - started }));
  return Response.json({ ok: true, grown, stopped, candidates: candidates.length });
}
