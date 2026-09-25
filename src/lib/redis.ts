import { sanitizeSecret } from "@/lib/env-secret";

/**
 * Upstash Redis の REST（サーバー専用）。Vercel の Marketplace から入れると KV_REST_API_URL / KV_REST_API_TOKEN が入る。
 * 無ければ null を返すので、呼ぶ側はメモリと一時ファイルに切り替える。
 */
export type Redis = { url: string; token: string };

export function redisConfig(): Redis | null {
  const url = sanitizeSecret(process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL);
  const token = sanitizeSecret(process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN);
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export async function redisCommand(config: Redis, command: (string | number)[]): Promise<unknown> {
  const response = await fetch(config.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(3_000),
  });
  const json = (await response.json().catch(() => null)) as { result?: unknown; error?: string } | null;
  if (!response.ok || !json || json.error) throw new Error(json?.error ?? `redis ${response.status}`);
  return json.result;
}
