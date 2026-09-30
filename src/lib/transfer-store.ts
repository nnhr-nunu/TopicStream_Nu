import { redisCommand, redisConfig } from "@/lib/redis";
import { TRANSFER_ID_PATTERN, TRANSFER_MAX_CHARS } from "@/lib/transfer";

/**
 * 別の端末への引き継ぎの預かり所（サーバー専用）。ブラウザで暗号化された文を、預かり番号で 15 分だけ預かる。
 * 中身は引き継ぎコードが無いと読めない（transfer.ts）。Redis が無ければこのサーバーのメモリに置く（開発用）。
 */
export const TRANSFER_TTL_SECONDS = 15 * 60;
/** Redis が無いときにメモリへ置く数 */
const MEMORY_LIMIT = 50;

const memory = new Map<string, { data: string; expiresAt: number }>();
const redisKey = (id: string) => `ts:transfer:${id}`;

export type SaveTransferResult = { ok: true; expiresAt: number } | { ok: false; reason: "invalid" | "storage" };

export async function saveTransfer(id: string, data: string, now = Date.now()): Promise<SaveTransferResult> {
  if (!TRANSFER_ID_PATTERN.test(id) || !data || data.length > TRANSFER_MAX_CHARS) return { ok: false, reason: "invalid" };
  const expiresAt = now + TRANSFER_TTL_SECONDS * 1000;
  const config = redisConfig();
  if (config) {
    try {
      await redisCommand(config, ["SET", redisKey(id), data, "EX", TRANSFER_TTL_SECONDS]);
      return { ok: true, expiresAt };
    } catch {
      // ほかのサーバー（インスタンス）から読めないと受け取れないので、預かったことにしない
      return { ok: false, reason: "storage" };
    }
  }
  for (const [key, item] of memory) {
    if (item.expiresAt <= now) memory.delete(key);
  }
  memory.set(id, { data, expiresAt });
  while (memory.size > MEMORY_LIMIT) {
    const oldest = memory.keys().next().value;
    if (oldest === undefined) break;
    memory.delete(oldest);
  }
  return { ok: true, expiresAt };
}

/** 預かっている暗号文（期限切れ・無ければ null）。時間内なら何度でも受け取れる */
export async function readTransfer(id: string, now = Date.now()): Promise<string | null> {
  if (!TRANSFER_ID_PATTERN.test(id)) return null;
  const config = redisConfig();
  if (config) {
    try {
      const raw = await redisCommand(config, ["GET", redisKey(id)]);
      return typeof raw === "string" ? raw : null;
    } catch {
      return null;
    }
  }
  const item = memory.get(id);
  if (!item) return null;
  if (item.expiresAt <= now) {
    memory.delete(id);
    return null;
  }
  return item.data;
}
