/**
 * 設定の「自分の AI キー」の接続テスト。/api/gemini/check の返事を、利用者に見せる一言にする。
 * モデル名や Google の生の返事は出さない（詳しい中身はサーバーのログと設定の「AI の利用状況」に残る）
 */

/** キーを作るページ（Google AI Studio） */
export const AI_STUDIO_KEY_URL = "https://aistudio.google.com/apikey";

/** /api/gemini/check の返事のうち、ここで読む部分 */
export type KeyCheckReply = {
  ok?: boolean;
  /** browser = 利用者が入れたキー、server = みんなで使っているキー、none = どちらも無い */
  source?: string;
  httpStatus?: number;
  googleMessage?: string;
  generation?: { ok?: boolean; reason?: string; googleMessage?: string; totalMs?: number };
};

export type KeyCheckResult = { ok: boolean; message: string };

function isQuota(text: string | undefined): boolean {
  const lower = (text ?? "").toLowerCase();
  return lower.includes("quota") || lower.includes("429") || lower.includes("billing");
}

/** status は /api/gemini/check の HTTP ステータス（届かなかったら 0） */
export function describeKeyCheck(status: number, reply: KeyCheckReply | null): KeyCheckResult {
  if (status === 404) {
    return { ok: false, message: "この公開版（デモ）にはサーバーが無いので、AI は使えません。AI を使える版でお試しください。" };
  }
  if (status === 429) return { ok: false, message: "続けて試したので、1 分ほど待ってからもう一度どうぞ。" };
  if (!reply || status === 0 || status >= 500) {
    return { ok: false, message: "確かめられませんでした。通信の状態を見て、もう一度お試しください。" };
  }
  const own = reply.source === "browser";
  if (reply.source === "none") {
    return { ok: false, message: "キーが入っていません。上の欄にキーを貼り付けてから、もう一度押してください。" };
  }
  if (!reply.ok) {
    if (reply.httpStatus === 400 || reply.httpStatus === 401 || reply.httpStatus === 403) {
      return {
        ok: false,
        message: own
          ? "このキーは Google に受け付けられませんでした。コピーし直して、前後に余分な文字が入っていないか確かめてください。"
          : "みんなで使っているキーに問題が起きています。自分のキーを入れると使えます。",
      };
    }
    return { ok: false, message: "Google に届きませんでした。少し待ってから、もう一度お試しください。" };
  }
  const generation = reply.generation;
  if (generation?.ok) {
    const seconds = typeof generation.totalMs === "number" ? `（${(generation.totalMs / 1000).toFixed(1)} 秒で返事がありました）` : "";
    return {
      ok: true,
      message: own
        ? `つながりました。これからは自分のキーで AI を使います${seconds}。`
        : `みんなで使っているキーは、いま動いています${seconds}。自分のキーを入れると、自分の枠で使えます。`,
    };
  }
  if (isQuota(generation?.reason) || isQuota(generation?.googleMessage)) {
    return {
      ok: false,
      message: own
        ? "キーは正しいですが、いまは利用上限に達しています。時間を置くと、また使えるようになります。"
        : "みんなで使っているキーは、いま利用上限に達しています。自分のキーを入れると、自分の枠で使えます。",
    };
  }
  return {
    ok: false,
    message: `${own ? "キーは正しいですが、" : ""}AI から返事がありませんでした（混み合っているのかもしれません）。少し待ってから、もう一度お試しください。`,
  };
}
