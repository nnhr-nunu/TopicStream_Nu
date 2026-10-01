import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ページが見つかりません | TopicStream(ぬ)",
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl font-bold tracking-tight text-primary">404</p>
      <h1 className="text-lg font-semibold">このページは見つかりませんでした</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        リンクが古いか、アドレスが間違っているかもしれません。作ったマップはこの端末に残っています。
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link
          href="/"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          ホームへ戻る
        </Link>
        <Link href="/topics/" className="rounded-xl border border-border px-4 py-2 text-sm transition hover:bg-muted">
          トピック図鑑を見る
        </Link>
      </div>
    </main>
  );
}
