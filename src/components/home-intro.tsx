import Link from "next/link";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** ホームの見出し（ロゴ・名前・キャッチ・一文）。ホームと、保存したマップを読み込む前の画面で同じものを出す */
export function HomeHeading() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- 静的エクスポート（Pages）でも同じパスで出すため */}
      <img src={`${base}/topicstream-logo.svg`} alt="" width={56} height={56} className="size-14 rounded-2xl" />
      <p className="mt-4 text-sm font-semibold text-primary">
        TopicStream<span className="ml-0.5 text-xs">(ぬ)</span>
      </p>
      <h1 className="mt-2 text-3xl leading-tight font-bold tracking-tight text-balance sm:text-5xl">
        もう、話題に詰まらない。
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-pretty text-muted-foreground [word-break:auto-phrase] sm:text-base">
        お題をひとつ入れるだけで、話せるネタや考えの切り口が 8 方向に広がる。
      </p>
    </>
  );
}

const LINK = "underline-offset-2 hover:underline";

/**
 * ブラウザに保存したマップを読み込むまでの画面。サーバーで描くので、検索のクローラーにも
 * トップの中身（見出し・説明・入口のリンク）が伝わる。読み込めたらホームか前のマップに替わる
 */
export function HomeIntro() {
  return (
    <div className="home-scroll" aria-busy="true">
      <div className="home-layout">
        <div className="home-rail" />
        <div className="mx-auto w-full min-w-0 max-w-4xl px-4 pt-24 sm:pt-28">
          <header className="flex flex-col items-center text-center">
            <HomeHeading />
            <p className="mt-7 text-sm text-muted-foreground">マップを読み込み中…</p>
            <p className="mt-6 max-w-xl text-xs leading-5 text-pretty text-muted-foreground [word-break:auto-phrase]">
              雑談配信のネタ切れやトークテーマ探しに。配信のコメントと連動し、OBS にも映せます。
            </p>
            <nav aria-label="ページ" className="mt-3 flex flex-wrap justify-center gap-4 text-xs text-primary">
              <Link href="/guide/" className={LINK}>
                使い方
              </Link>
              <Link href="/topics/" className={LINK}>
                トピック図鑑
              </Link>
              <Link href="/community/" className={LINK}>
                みんなが作った話題マップ
              </Link>
            </nav>
          </header>
        </div>
      </div>
    </div>
  );
}
