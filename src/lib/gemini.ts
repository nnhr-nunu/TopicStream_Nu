import { CHILD_COUNT, DEFAULT_MODEL } from "@/lib/constants";
import { sanitizeSecret } from "@/lib/env-secret";
import { mockRelatedTopics } from "@/lib/mock-topics";
import type { GenerateResult } from "@/lib/types";

export async function generateRelatedTopics(options: {
  seed: string;
  existing: string[];
  apiKey?: string;
  model?: string;
  count?: number;
  preferred?: string[];
}): Promise<GenerateResult> {
  const count = options.count ?? CHILD_COUNT;
  const mock = mockRelatedTopics(options.seed, options.existing, count, options.preferred ?? []);
  const override = sanitizeSecret(options.apiKey);

  try {
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seed: options.seed,
        existing: options.existing,
        model: options.model?.trim() || DEFAULT_MODEL,
        count,
        preferred: options.preferred ?? [],
        apiKey: override || undefined,
      }),
    });
    if (!response.ok) {
      throw new Error(`gemini proxy ${response.status}`);
    }
    const json = (await response.json()) as GenerateResult;
    if (!Array.isArray(json.topics) || json.topics.length === 0) {
      return {
        topics: mock,
        source: "mock",
        warning: json.warning ?? "AIの返答が空だったので、オフライン生成に切り替えました",
        debug: json.debug,
      };
    }
    return {
      topics: json.topics.slice(0, count),
      source: json.source === "gemini" ? "gemini" : "mock",
      warning: json.warning,
      debug: json.debug,
    };
  } catch {
    return {
      topics: mock,
      source: "mock",
      warning: "Geminiに届かなかったので、オフライン生成を使いました",
      debug: { reason: "proxy", kind: "network", host: "local", model: options.model?.trim() || DEFAULT_MODEL },
    };
  }
}
