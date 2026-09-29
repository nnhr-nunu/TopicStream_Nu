/**
 * 公開の書き込み口（票・共有・配信一覧・チャット読み込みなど）の回数制限（サーバー専用・インスタンスごとのメモリ）。
 * Vercel ではインスタンスが複数になりうるので厳密な全体制限ではない。1 人の連打や荒らしで
 * 図鑑・一覧が埋まったり、API の枠を使い切られたりしないための目安。
 */
export function createRateLimit(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  /** key（多くは IP）で cost 回ぶん使ってよいか。よければ数えて true */
  return function allow(key: string, cost = 1): boolean {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
    if (recent.length + cost > limit) {
      hits.set(key, recent);
      return false;
    }
    for (let i = 0; i < cost; i += 1) recent.push(t);
    hits.set(key, recent);
    // 来なくなった人の記録を溜めない
    if (hits.size > 10_000) {
      for (const [id, times] of hits) {
        if (times.every((at) => t - at >= windowMs)) hits.delete(id);
      }
    }
    return true;
  };
}

export function tooManyRequests(retryAfterSeconds = 60): Response {
  return Response.json(
    { error: "短い時間に続けて送られたので、少し待ってからもう一度お試しください。" },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

/** 本文が大きすぎる（巨大な JSON で固めない）。Content-Length が無いときは読んでから長さを見る */
export async function readJsonBody<T>(request: Request, maxBytes: number): Promise<T | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  const text = await request.text().catch(() => "");
  if (!text || text.length > maxBytes) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
