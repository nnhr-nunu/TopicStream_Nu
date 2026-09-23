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

export function readGeminiApiKey(): string {
  return sanitizeSecret(process.env.GEMINI_API_KEY);
}
