import { CHILD_COUNT, DEFAULT_MODEL } from "@/lib/constants";
import { readGeminiApiKey, sanitizeSecret } from "@/lib/env-secret";
import { geminiFailureWarning, requestGemini } from "@/lib/gemini-core";
import { mockRelatedTopics } from "@/lib/mock-topics";
import type { GenerateResult } from "@/lib/types";

function mockResult(seed: string, existing: string[], count: number, preferred: string[], warning?: string): GenerateResult {
  return {
    topics: mockRelatedTopics(seed, existing, count, preferred),
    source: "mock",
    warning,
  };
}

const MISSING_KEY_HINT =
  "Vercel の GEMINI_API_KEY が空です。いまの長い *-projects.vercel.app は Preview 用なので、環境変数は Production だけでなく Preview にも入れてください。変えたあとは再デプロイが必要です。";

export async function GET() {
  const configured = Boolean(readGeminiApiKey());
  return Response.json({
    configured,
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
  const model = typeof body?.model === "string" && body.model.trim() ? body.model.trim() : DEFAULT_MODEL;
  const override = typeof body?.apiKey === "string" ? sanitizeSecret(body.apiKey) : "";
  const apiKey = override || readGeminiApiKey();

  if (!apiKey) {
    return Response.json(
      mockResult(seed, existing, count, preferred, `${MISSING_KEY_HINT} オフライン生成を使いました。`),
    );
  }

  try {
    const remote = await requestGemini({ seed, existing, apiKey, model, count });
    const mock = mockRelatedTopics(seed, existing, count, preferred);
    const merged = [...remote];
    for (const extra of mock) {
      if (merged.length >= count) break;
      if (!merged.includes(extra) && extra !== seed) merged.push(extra);
    }
    const result: GenerateResult = {
      topics: merged.slice(0, count),
      source: remote.length > 0 ? "gemini" : "mock",
      warning: remote.length > 0 ? undefined : "AIの返答が空だったので、オフライン生成に切り替えました",
    };
    return Response.json(result);
  } catch (error) {
    return Response.json(mockResult(seed, existing, count, preferred, geminiFailureWarning(error)));
  }
}
