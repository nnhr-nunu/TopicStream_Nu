/**
 * 画面のどこからでも設定シートを開き、その中の欄（id が `settings-<section>` の要素）まで送る。
 * 配信中に「AI の上限」などのお知らせから、歯車 → スクロールと探さずに直接行けるように
 */
export const OPEN_SETTINGS_EVENT = "topicstream:open-settings";

export function openSettings(section?: string) {
  window.dispatchEvent(new CustomEvent<string | undefined>(OPEN_SETTINGS_EVENT, { detail: section }));
}

/**
 * AI のお知らせに付ける「キーを入れる」。みんなの枠が尽きた・自分のキーが使えないときだけ
 * （自分のキーの上限なら、設定を開いても直せないので付けない）
 */
export function aiKeyToastAction(kind: string | undefined, ownKey: boolean): { label: string; onClick: () => void } | undefined {
  if (kind === "key") return { label: "キーを確かめる", onClick: () => openSettings("ai-key") };
  if (kind === "quota" && !ownKey) return { label: "キーを入れる", onClick: () => openSettings("ai-key") };
  return undefined;
}
