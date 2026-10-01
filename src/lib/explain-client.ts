import { apiPath, isNoServerResponse } from "@/lib/api-base";
import { DEFAULT_MODEL } from "@/lib/constants";
import { sanitizeSecret } from "@/lib/env-secret";
import { offlineExplanation, type Explanation } from "@/lib/explain";
import type { BoardMode } from "@/lib/types";

export type ExplainResult = Explanation & { warning?: string };

/** 開き直したときに AI を呼び直さない（このタブの間だけ） */
const memory = new Map<string, ExplainResult>();

/**
 * カードの言葉の解説をサーバーに頼む。サーバーの無い公開版（404）や失敗時は、
 * 手元で言えること（「言葉：意味」のカードの意味）と検索語だけ返す。
 */
export async function fetchExplanation(options: {
  label: string;
  context: string[];
  mode?: BoardMode;
  apiKey?: string;
  model?: string;
}): Promise<ExplainResult> {
  const key = `${options.mode ?? "chat"}|${options.label}|${options.context.join("›")}`;
  const hit = memory.get(key);
  if (hit) return hit;
  const offline = offlineExplanation(options.label, options.context);
  try {
    const response = await fetch(apiPath("/api/explain"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: options.label,
        context: options.context,
        mode: options.mode,
        model: options.model?.trim() || DEFAULT_MODEL,
        apiKey: sanitizeSecret(options.apiKey) || undefined,
      }),
    });
    if (isNoServerResponse(response)) return offline;
    if (!response.ok) throw new Error(`explain ${response.status}`);
    const json = (await response.json()) as Partial<ExplainResult>;
    const result: ExplainResult = {
      text: typeof json.text === "string" ? json.text : offline.text,
      source: json.source === "gemini" ? "gemini" : "offline",
      query: typeof json.query === "string" && json.query ? json.query : offline.query,
      warning: typeof json.warning === "string" ? json.warning : undefined,
    };
    if (result.source === "gemini") memory.set(key, result);
    return result;
  } catch {
    return { ...offline, warning: "AI に届かなかったので、解説を出せませんでした。" };
  }
}
