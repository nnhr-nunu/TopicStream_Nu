"use client";

import { useEffect } from "react";

/**
 * 画面の途中で落ちたとき。真っ白な画面にせず、読み込み直し・トップへの道を出す。
 * ボードはブラウザに保存されているので、読み込み直せば続きから使える
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[TopicStream]", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-semibold">うまく表示できませんでした</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        一時的な不具合かもしれません。作ったボードはこの端末に残っているので、もう一度読み込んでみてください。
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          もう一度表示する
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl border border-border px-4 py-2 text-sm transition hover:bg-muted"
        >
          ページを読み込み直す
        </button>
      </div>
      {error.digest ? <p className="text-[11px] text-muted-foreground">エラー番号: {error.digest}</p> : null}
    </main>
  );
}
