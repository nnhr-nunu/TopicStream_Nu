import { CHILD_COUNT, DEFAULT_MODEL } from "@/lib/constants";
import { sanitizeSecret } from "@/lib/env-secret";
import { isJunkTopic, padTopics } from "@/lib/gemini-core";
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
    if (response.status === 404) {
      // GitHub Pages（サーバーの無い公開版）はオフライン生成が普通の動きなので、何も知らせない
      return { topics: mock, source: "mock" };
    }
    if (!response.ok) {
      throw new Error(`gemini proxy ${response.status}`);
    }
    const json = (await response.json()) as GenerateResult;
    const parsed = (Array.isArray(json.topics) ? json.topics : []).filter(
      (item): item is string => typeof item === "string" && !isJunkTopic(item),
    );
    const topics = padTopics(parsed, mock, count, options.seed);
    if (parsed.length === 0) {
      return {
        topics,
        source: "mock",
        warning: json.warning,
        noticeKind: json.noticeKind,
        debug: json.debug,
      };
    }
    return {
      topics,
      source: json.source === "gemini" ? "gemini" : "mock",
      warning: json.warning,
      noticeKind: json.noticeKind,
      debug: json.debug,
    };
  } catch {
    return {
      topics: mock,
      source: "mock",
      warning: "AI に届かなかったので、今回はオフラインの候補で広げました。",
      noticeKind: "unavailable",
      debug: { reason: "proxy", host: "local", model: options.model?.trim() || DEFAULT_MODEL },
    };
  }
}
