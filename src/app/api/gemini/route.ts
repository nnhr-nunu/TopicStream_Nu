import { CHILD_COUNT, DEFAULT_MODEL } from "@/lib/constants";
import { requestGemini } from "@/lib/gemini-core";
import { mockRelatedTopics } from "@/lib/mock-topics";
import type { GenerateResult } from "@/lib/types";

function mockResult(seed: string, existing: string[], count: number, preferred: string[], warning?: string): GenerateResult {
  return {
    topics: mockRelatedTopics(seed, existing, count, preferred),
    source: "mock",
    warning,
  };
}

export async function GET() {
  return Response.json({ configured: Boolean(process.env.GEMINI_API_KEY?.trim()) });
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
  const override = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  const apiKey = override || process.env.GEMINI_API_KEY?.trim() || "";

  if (!apiKey) {
    return Response.json(
      mockResult(seed, existing, count, preferred, "ホストに GEMINI_API_KEY がないので、オフライン生成を使いました"),
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
  } catch {
    return Response.json(mockResult(seed, existing, count, preferred, "Geminiに届かなかったので、オフライン生成を使いました"));
  }
}
