/** Google AdSense の設定。ID は公開値なので環境変数（Vercel の Environment Variables）から入れる。 */

export type AdConfig = {
  /** `ca-pub-` で始まるパブリッシャー ID。空なら広告を一切出さない。 */
  client: string;
  /** ディスプレイ広告ユニットのスロット ID。空なら枠を出さない。 */
  slot: string;
};

const CLIENT_PATTERN = /^ca-pub-\d{10,20}$/;
const SLOT_PATTERN = /^\d{6,20}$/;

export function readAdConfig(env: {
  client?: string | undefined;
  slot?: string | undefined;
}): AdConfig {
  const client = env.client?.trim() ?? "";
  const slot = env.slot?.trim() ?? "";
  if (!CLIENT_PATTERN.test(client)) return { client: "", slot: "" };
  return { client, slot: SLOT_PATTERN.test(slot) ? slot : "" };
}

// NEXT_PUBLIC_* はビルド時に文字列へ置き換わるので、プロパティを直接参照する。
export const adConfig = readAdConfig({
  client: process.env.NEXT_PUBLIC_ADSENSE_CLIENT,
  slot: process.env.NEXT_PUBLIC_ADSENSE_SLOT,
});

export function adScriptSrc(client: string): string {
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
}
