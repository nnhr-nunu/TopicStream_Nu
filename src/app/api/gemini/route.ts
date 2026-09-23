import { CHILD_COUNT, DEFAULT_MODEL, GEMINI_HOST, resolveGeminiModel } from "@/lib/constants";
import { readGeminiApiKey, sanitizeSecret } from "@/lib/env-secret";
import { geminiDebug, geminiFailureWarning, GeminiRequestError, requestGemini } from "@/lib/gemini-core";
import { mockRelatedTopics } from "@/lib/mock-topics";
import type { GenerateResult, GeminiDebug } from "@/lib/types";

export const maxDuration = 15;

function mockResult(
  seed: string,
  existing: string[],
  count: number,
  preferred: string[],
  warning: string,
  debug: GeminiDebug,
): GenerateResult {
  return {
    topics: mockRelatedTopics(seed, existing, count, preferred),
    source: "mock",
    warning,
    debug,
  };
}

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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    seed?: unknown;
    existing?: unknown;
    model?: unknown;
    count?: unknown;
    preferred?: unknown;
    apiKey?: unknown;
  } | null;

  const seed = typeof body?.seed === "string" ? body.seed.trim() : "";
  if (!seed) {
    return Response.json({ error: "お題が空です" }, { status: 400 });
  }

  const existing = Array.isArray(body?.existing)
    ? body.existing.filter((item): item is string => typeof item === "string")
    : [];
  const preferred = Array.isArray(body?.preferred)
    ? body.preferred.filter((item): item is string => typeof item === "string")
    : [];
  const count = typeof body?.count === "number" && body.count > 0 ? Math.min(12, Math.round(body.count)) : CHILD_COUNT;
  const model = resolveGeminiModel(typeof body?.model === "string" ? body.model : DEFAULT_MODEL);
  const override = typeof body?.apiKey === "string" ? sanitizeSecret(body.apiKey) : "";
  const apiKey = override || readGeminiApiKey();

  if (!apiKey) {
    const debug = geminiDebug({ reason: "missing-key", model });
    logDebug(debug);
    return Response.json(mockResult(seed, existing, count, preferred, `${MISSING_KEY_HINT} オフライン生成を使いました。`, debug));
  }

  try {
    const remote = await requestGemini({ seed, existing, apiKey, model, count });
    const mock = mockRelatedTopics(seed, existing, count, preferred);
    const merged = [...remote.topics];
    for (const extra of mock) {
      if (merged.length >= count) break;
      if (!merged.includes(extra) && extra !== seed) merged.push(extra);
    }
    if (remote.topics.length === 0) {
      const debug = geminiDebug({ reason: "empty", model: remote.model, tried: remote.tried });
      logDebug(debug);
      return Response.json({
        topics: merged.slice(0, count),
        source: "mock" as const,
        warning: `AIの返答が空だったので、オフライン生成に切り替えました（empty・${remote.model}）。`,
        debug,
      });
    }
    return Response.json({
      topics: merged.slice(0, count),
      source: "gemini" as const,
    });
  } catch (error) {
    const debug =
      error instanceof GeminiRequestError
        ? error.debug
        : geminiDebug({ reason: "network", model, host: GEMINI_HOST });
    logDebug(debug);
    return Response.json(mockResult(seed, existing, count, preferred, geminiFailureWarning(error), debug));
  }
}
