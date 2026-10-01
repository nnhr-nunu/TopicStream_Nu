/** Vercel の画面に `"` 付きで貼ったキーでも読めるようにする。値そのものは返さない。 */
export function sanitizeSecret(raw: string | undefined | null): string {
  if (!raw) return "";
  let value = raw.trim().replace(/^\uFEFF/, "");
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.length >= 2 && value.endsWith(quote)) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

/**
 * 利用者が貼った AI キー。Web ページからコピーすると改行・ゼロ幅の文字などが混ざることがある。
 * そのままだと通信の段階で失敗して「Google に届かない」と案内してしまうので、キーに使われない文字は外す
 */
export function sanitizeApiKey(raw: string | undefined | null): string {
  return sanitizeSecret(raw).replace(/[^!-~]/g, "").slice(0, 200);
}

export function readGeminiApiKey(): string {
  return sanitizeSecret(process.env.GEMINI_API_KEY);
}

/** ログや画面にキーが混ざらないようにする。 */
export function redactSecret(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z_-]{8,}/g, "[redacted]")
    .replace(/key=[^&\s"'`]+/gi, "key=[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
}
