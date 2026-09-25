/** Google AdSense の設定。スロット ID は公開値なので環境変数（Vercel の Environment Variables）から入れる。 */

export type AdConfig = {
  /** `ca-pub-` で始まるパブリッシャー ID。空なら広告を一切出さない。 */
  client: string;
  /** ディスプレイ広告ユニットのスロット ID。空なら枠を出さない。 */
  slot: string;
  /** 横幅が広い画面の両サイドに出す縦長ユニットのスロット ID。未設定なら `slot` を使う。 */
  sideSlot: string;
};

const CLIENT_PATTERN = /^ca-pub-\d{10,20}$/;
const SLOT_PATTERN = /^\d{6,20}$/;

export function readAdConfig(env: {
  client?: string | undefined;
  slot?: string | undefined;
  sideSlot?: string | undefined;
}): AdConfig {
  const client = env.client?.trim() ?? "";
  if (!CLIENT_PATTERN.test(client)) return { client: "", slot: "", sideSlot: "" };
  const valid = (value: string | undefined) => {
    const trimmed = value?.trim() ?? "";
    return SLOT_PATTERN.test(trimmed) ? trimmed : "";
  };
  const slot = valid(env.slot);
  return { client, slot, sideSlot: valid(env.sideSlot) || slot };
}

/** 推しログ(ぬ)と共通の AdSense パブリッシャー ID（公開値）。oshilog.life/ads.txt と一致させる。 */
export const ADSENSE_PUBLISHER_ID = "ca-pub-6017408302754244";

// NEXT_PUBLIC_* はビルド時に文字列へ置き換わるので、プロパティを直接参照する。
// パブリッシャー ID は公開値なので既定で入れる（審査のサイト確認用）。スロットは承認後に env で足す。
export const adConfig = readAdConfig({
  client: process.env.NEXT_PUBLIC_ADSENSE_CLIENT || ADSENSE_PUBLISHER_ID,
  slot: process.env.NEXT_PUBLIC_ADSENSE_SLOT,
  sideSlot: process.env.NEXT_PUBLIC_ADSENSE_SIDE_SLOT,
});

export function adScriptSrc(client: string): string {
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
}
