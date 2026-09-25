import { CHILD_COUNT, DEFAULT_MODEL, GEMINI_HOST } from "@/lib/constants";
import { readGeminiApiKey, sanitizeSecret } from "@/lib/env-secret";
import {
  geminiDebug,
  geminiFailureWarning,
  GeminiRequestError,
  geminiUserNotice,
  padTopics,
  requestGemini,
} from "@/lib/gemini-core";
import { clientKeyFromHeaders, createGeminiGuard } from "@/lib/gemini-guard";
import { recordSharedKnowledge } from "@/lib/knowledge-server";
import { mockRelatedTopics } from "@/lib/mock-topics";
import { isArchived } from "@/lib/topic-archive";
import type { GeminiDebug } from "@/lib/types";

/** モデルを替えて試す分の余裕（gemini-core の GEMINI_DEADLINE_MS は 24 秒）。 */
export const maxDuration = 30;

/** インスタンスが生きている間だけ効く交通整理（回数制限・同時実行・書き出しの使い回し） */
const guard = createGeminiGuard();

const MISSING_KEY_HINT =
  "Vercel の GEMINI_API_KEY が空です。いまの長い *-projects.vercel.app は Preview 用なので、環境変数は Production だけでなく Preview にも入れてください。変えたあとは再デプロイが必要です。";

function logDebug(debug: GeminiDebug) {
  console.info("[gemini]", JSON.stringify(debug));
}

export async function GET() {
  const configured = Boolean(readGeminiApiKey());
  return Response.json({
    configured,
    note: "configured は環境変数があることだけです。Google がキーを受け付けたかは POST で確認します。",
    hint: configured ? undefined : `${MISSING_KEY_HINT} GitHub Pages ではサーバーキーは使えません。`,
  });
}

/** 画面へ返す最後の1行（stream のときは NDJSON の "done"、そうでなければ JSON 本体） */
type Final = {
  topics: string[];
  source: "gemini" | "mock";
  warning?: string;
  noticeKind?: string;
  debug?: GeminiDebug;
};

type Input = {
  seed: string;
  existing: string[];
  preferred: string[];
  count: number;
  model: string;
  apiKey: string;
  clientKey: string;
};

/** AI を呼ぶ本体。届いた語は onTopic で先に渡し、最後に足りない分をオフライン候補で埋めて返す。 */
async function generate(input: Input, sendTopic: (label: string) => void): Promise<Final> {
  const { seed, existing, preferred, count, model, apiKey } = input;
  // アーカイブした語（図鑑で隠している微妙な語）は、AI がまた出しても画面に出さない
  const onTopic = (label: string) => {
    if (!isArchived(seed, label)) sendTopic(label);
  };
  const mock = () => mockRelatedTopics(seed, existing, count, preferred);

  if (!apiKey) {
    const debug = geminiDebug({ reason: "missing-key", model });
    logDebug(debug);
    // キーの無い公開版ではオフライン生成が普通の動きなので、利用者には何も出さない（原因は debug とサーバーログに残す）
    return { topics: mock(), source: "mock", debug };
  }

  const cacheKey = guard.cacheKey(seed, existing, count);
  const cached = guard.readCache(cacheKey);
  if (cached) {
    const fresh = cached.filter((label) => !isArchived(seed, label));
    for (const label of fresh) onTopic(label);
    return { topics: padTopics(fresh, mock(), count, seed), source: "gemini" };
  }

  const slot = guard.acquire(input.clientKey);
  if (!slot.ok) {
    const debug = geminiDebug({ reason: `guard-${slot.reason}`, model });
    logDebug(debug);
    return {
      topics: mock(),
      source: "mock",
      warning:
        slot.reason === "rate"
          ? "続けてたくさん広げたので、少しの間はオフラインの候補で広げます。"
          : "AI が混み合っているので、今回はオフラインの候補で広げました。",
      noticeKind: slot.reason === "rate" ? "rate" : "busy",
      debug,
    };
  }

  try {
    const remote = await requestGemini({ seed, existing, apiKey, model, count, onTopic });
    guard.writeCache(cacheKey, remote.topics);
    // みんなのトピック図鑑へ（次から同じ・似たお題は AI を呼ばずに出せる）
    await recordSharedKnowledge(seed, remote.topics);
    const fresh = remote.topics.filter((label) => !isArchived(seed, label));
    return { topics: padTopics(fresh, mock(), count, seed), source: "gemini" };
  } catch (error) {
    const debug =
      error instanceof GeminiRequestError ? error.debug : geminiDebug({ reason: "network", model, host: GEMINI_HOST });
    logDebug(debug);
    // 技術的な詳細（試したモデル・Google の返事）はサーバーログへ。利用者には短いお知らせだけ返す
    console.warn("[gemini]", geminiFailureWarning(error));
    const notice = geminiUserNotice(error);
    return { topics: mock(), source: "mock", warning: notice.message, noticeKind: notice.kind, debug };
  } finally {
    slot.release();
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    seed?: unknown;
    existing?: unknown;
    model?: unknown;
    count?: unknown;
    preferred?: unknown;
    apiKey?: unknown;
    stream?: unknown;
  } | null;

  const seed = typeof body?.seed === "string" ? body.seed.trim() : "";
  if (!seed) {
    return Response.json({ error: "お題が空です" }, { status: 400 });
  }

  const override = typeof body?.apiKey === "string" ? sanitizeSecret(body.apiKey) : "";
  const input: Input = {
    seed,
    existing: Array.isArray(body?.existing)
      ? body.existing.filter((item): item is string => typeof item === "string").slice(0, 200)
      : [],
    preferred: Array.isArray(body?.preferred)
      ? body.preferred.filter((item): item is string => typeof item === "string")
      : [],
    count: typeof body?.count === "number" && body.count > 0 ? Math.min(12, Math.round(body.count)) : CHILD_COUNT,
    model: typeof body?.model === "string" && body.model.trim() ? body.model.trim() : DEFAULT_MODEL,
    apiKey: override || readGeminiApiKey(),
    clientKey: clientKeyFromHeaders(request.headers),
  };

  if (body?.stream !== true) {
    return Response.json(await generate(input, () => undefined));
  }

  // 1語届くたびに1行送る（NDJSON）。画面はそれを空のカードへ順に入れる。
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (value: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      const sent = new Set<string>();
      try {
        const final = await generate(input, (label) => {
          if (sent.has(label)) return;
          sent.add(label);
          send({ type: "topic", label });
        });
        send({ type: "done", ...final });
      } catch {
        send({ type: "done", topics: mockRelatedTopics(seed, input.existing, input.count, input.preferred), source: "mock" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
