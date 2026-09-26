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
import { mockDetailTopics } from "@/lib/detail-modes";
import { clientKeyFromHeaders, createGeminiGuard } from "@/lib/gemini-guard";
import { recordSharedKnowledge } from "@/lib/knowledge-server";
import { isGenericAngle, mockRelatedTopics } from "@/lib/mock-topics";
import { parseMode } from "@/lib/modes";
import { isArchived } from "@/lib/topic-archive";
import type { BoardMode, GeminiDebug } from "@/lib/types";

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
  /** 広げるカードの祖先（近い順） */
  context: string[];
  mode: BoardMode;
  /** 「具体的にする」: 対応策・答えを短い文で。図鑑には記録しない */
  detail: boolean;
  count: number;
  model: string;
  apiKey: string;
  clientKey: string;
};

/** AI を呼ぶ本体。届いた語は onTopic で先に渡し、最後に足りない分をオフライン候補で埋めて返す。 */
async function generate(input: Input, sendTopic: (label: string) => void): Promise<Final> {
  const { seed, existing, preferred, context, mode, detail, count, model, apiKey } = input;
  // アーカイブした語（図鑑で隠している微妙な語）は、AI がまた出しても画面に出さない
  const onTopic = (label: string) => {
    if (!isArchived(seed, label)) sendTopic(label);
  };
  const mock = () =>
    detail ? mockDetailTopics(seed, existing, count, mode, context) : mockRelatedTopics(seed, existing, count, preferred, { context, mode });

  if (!apiKey) {
    const debug = geminiDebug({ reason: "missing-key", model });
    logDebug(debug);
    // キーの無い公開版ではオフライン生成が普通の動きなので、利用者には何も出さない（原因は debug とサーバーログに残す）
    return { topics: mock(), source: "mock", debug };
  }

  const cacheKey = guard.cacheKey(seed, existing, count, detail ? `${mode}:detail` : mode);
  const cached = guard.readCache(cacheKey);
  if (cached) {
    const fresh = cached.filter((label) => !isArchived(seed, label));
    for (const label of fresh) onTopic(label);
    return { topics: padTopics(fresh, mock(), count, seed, detail), source: "gemini" };
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
    const remote = await requestGemini({ seed, existing, context, mode, detail, apiKey, model, count, onTopic });
    guard.writeCache(cacheKey, remote.topics);
    // みんなのトピック図鑑へ（次から同じ・似たお題は AI を呼ばずに出せる）
    // 汎用の切り口（「一番の失敗談」など）の結果は元のお題しだいなので、このお題の語としてはためない
    // お悩み相談などもモードごとに分けて記録する（公開前提。個人につながりそうな語は記録側で捨てる）
    // 「具体的にする」の答えは相談ごとの文なので記録しない（図鑑は短い切り口の集まり）
    if (!isGenericAngle(seed) && !detail) await recordSharedKnowledge(seed, remote.topics, mode);
    const fresh = remote.topics.filter((label) => !isArchived(seed, label));
    return { topics: padTopics(fresh, mock(), count, seed, detail), source: "gemini" };
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
    context?: unknown;
    mode?: unknown;
    detail?: unknown;
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
    context: Array.isArray(body?.context)
      ? body.context
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim().slice(0, 48))
          .filter(Boolean)
          .slice(0, 3)
      : [],
    mode: parseMode(body?.mode),
    detail: body?.detail === true,
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
        const topics = input.detail
          ? mockDetailTopics(seed, input.existing, input.count, input.mode, input.context)
          : mockRelatedTopics(seed, input.existing, input.count, input.preferred, { context: input.context, mode: input.mode });
        send({ type: "done", topics, source: "mock" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
