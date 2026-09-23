import {
  DEFAULT_MODEL,
  GEMINI_FALLBACK_MODELS,
  GEMINI_HOST,
  LABEL_MAX,
  RETIRED_GEMINI_MODELS,
} from "@/lib/constants";
import { redactSecret } from "@/lib/env-secret";
import type { GeminiDebug } from "@/lib/types";

export type { GeminiDebug };

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
