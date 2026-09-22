import { CHILD_COUNT, DEFAULT_MODEL, LABEL_MAX } from "@/lib/constants";
import { mockRelatedTopics } from "@/lib/mock-topics";
import type { GenerateResult } from "@/lib/types";

const GEMINI_TIMEOUT_MS = 2800;

function buildPrompt(seed: string, existing: string[], count: number): string {
  const banned = existing.slice(0, 24).join(" / ") || "なし";
  return `あなたはVTuberの雑談配信アドバイザーです。
お題「${seed}」から、配信で話が自然に広がる関連キーワードを${count}個出してください。

条件:
- 日本語のみ
- 各キーワードは2〜${LABEL_MAX}文字の短い名詞句
- 番号・説明・引用符は付けない
- お題そのものは繰り返さない
- 次と重複しない: ${banned}
- 体験・比較・失敗・推し・あるあるなど、すぐ話せる具体寄り

JSON配列だけを返すこと。例: ["キーワード1","キーワード2"]`;
}

function clip(label: string): string {
  const trimmed = label.replace(/^[0-9]+[\.\):]\s*/, "").replace(/^[-・]\s*/, "").trim();
  if (trimmed.length <= LABEL_MAX) return trimmed;
  return `${trimmed.slice(0, LABEL_MAX - 1)}…`;
}

function parseTopics(raw: string, seed: string, existing: string[]): string[] {
  const match = raw.match(/\[[\s\S]*\]/);
  let values: unknown[] = [];
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as unknown;
      if (Array.isArray(parsed)) values = parsed;
    } catch {
      values = [];
    }
  }
  if (values.length === 0) {
    values = raw
      .split(/[\n,、]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  const banned = new Set([seed.trim(), ...existing.map((item) => item.trim())]);
  const topics: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const label = clip(value);
    if (!label || banned.has(label) || topics.includes(label)) continue;
    topics.push(label);
  }
  return topics;
}

async function requestGemini(
  seed: string,
  existing: string[],
  apiKey: string,
  model: string,
  count: number,
): Promise<string[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(seed, existing, count) }] }],
        generationConfig: {
          temperature: 0.95,
          maxOutputTokens: 320,
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`Gemini HTTP ${response.status}`);
    }
    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
    return parseTopics(text, seed, existing);
  } finally {
    window.clearTimeout(timer);
  }
}

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
  const key = options.apiKey?.trim();
  if (!key) {
    return { topics: mock, source: "mock" };
  }

  try {
    const model = options.model?.trim() || DEFAULT_MODEL;
    const remote = await requestGemini(options.seed, options.existing, key, model, count);
    const merged = [...remote];
    for (const extra of mock) {
      if (merged.length >= count) break;
      if (!merged.includes(extra) && extra !== options.seed) merged.push(extra);
    }
    return {
      topics: merged.slice(0, count),
      source: remote.length > 0 ? "gemini" : "mock",
      warning: remote.length > 0 ? undefined : "AIの返答が空だったので、オフライン生成に切り替えました",
    };
  } catch {
    return {
      topics: mock,
      source: "mock",
      warning: "Geminiに届かなかったので、オフライン生成を使いました",
    };
  }
}
