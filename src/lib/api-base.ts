/**
 * サーバーの口（/api/*）を呼ぶときの共通の決まり（クライアント）。
 * GitHub Pages のキー無しデモにはサーバーが無いので、そう分かる返事なら呼ぶ側はオフラインの動きに切り替える。
 */

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function apiPath(path: string): string {
  return `${base}${path}`;
}

/** サーバーの無い公開版の返事。POST には 404 / 405、または普通の HTML のページが返る */
export function isNoServerResponse(response: Pick<Response, "status" | "ok" | "headers">): boolean {
  if (response.status === 404 || response.status === 405 || response.status === 501) return true;
  return response.ok && !/json/i.test(response.headers.get("content-type") ?? "");
}
