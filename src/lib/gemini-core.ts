import { LABEL_MAX } from "@/lib/constants";

export function buildPrompt(seed: string, existing: string[], count: number): string {
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

export function parseTopics(raw: string, seed: string, existing: string[]): string[] {
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

export const GEMINI_TIMEOUT_MS = 2800;

export class GeminiRequestError extends Error {
  constructor(
    readonly kind: "http" | "timeout" | "network",
    readonly status?: number,
  ) {
    super("gemini");
    this.name = "GeminiRequestError";
  }
}

/** 失敗理由の日本語。キーやURLは含めない。 */
export function geminiFailureWarning(error: unknown): string {
  if (error instanceof GeminiRequestError) {
    if (error.kind === "http" && error.status && [400, 401, 403].includes(error.status)) {
      return "Gemini がキーを受け付けませんでした。前後の引用符や空白を外し、Vercel の Preview と Production の両方に GEMINI_API_KEY があるか確認してください。オフライン生成を使いました。";
    }
    if (error.kind === "http" && error.status === 429) {
      return "Gemini が混み合っているので、オフライン生成を使いました。";
    }
    if (error.kind === "timeout") {
      return "Gemini の応答が遅かったので、オフライン生成を使いました。";
    }
  }
  return "Gemini に届かなかったので、オフライン生成を使いました。";
}

export async function requestGemini(options: {
  seed: string;
  existing: string[];
  apiKey: string;
  model: string;
  count: number;
}): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent?key=${encodeURIComponent(options.apiKey)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(options.seed, options.existing, options.count) }] }],
        generationConfig: {
          temperature: 0.95,
          maxOutputTokens: 320,
        },
      }),
    });
    if (!response.ok) {
      throw new GeminiRequestError("http", response.status);
    }
    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
    return parseTopics(text, options.seed, options.existing);
  } catch (error) {
    if (error instanceof GeminiRequestError) throw error;
    if (typeof error === "object" && error && (error as { name?: string }).name === "AbortError") {
      throw new GeminiRequestError("timeout");
    }
    throw new GeminiRequestError("network");
  } finally {
    clearTimeout(timer);
  }
}
