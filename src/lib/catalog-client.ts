import type { CatalogBoard } from "@/lib/catalog-data";
import type { PopularTopic } from "@/lib/popularity";

export type CatalogResponse = { boards?: CatalogBoard[]; popular?: PopularTopic[] };

let pending: Promise<CatalogResponse> | null = null;

/**
 * みんなが作った話題マップと人気のお題（検索なし）を読む（クライアント）。
 * ホームでは一覧と「人気のお題」の両方が使うので、同時の読み込みは 1 回にまとめる（全ボードのカードが入っていて重い）。
 * GitHub Pages のようにサーバーが無いときは失敗する（呼ぶ側で手元の分を出す）。
 */
export function fetchCatalog(): Promise<CatalogResponse> {
  if (pending) return pending;
  const request = fetch("/api/catalog").then((response) => response.json() as Promise<CatalogResponse>);
  pending = request;
  // 読み終えたら手放す（ホームへ戻ってきたときは読み直して、新しい一覧を出す）
  const release = () => {
    if (pending === request) pending = null;
  };
  request.then(release, release);
  return request;
}
