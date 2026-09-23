const LINK = "break-all text-primary underline-offset-2 hover:underline";

const RELATED = [
  { label: "推し活支援サービス：推しログ(ぬ)", href: "https://oshilog.life/" },
  {
    label: "配信者向け写真表示ソフト：StreamMediaViewer(ぬ)",
    href: "https://x.com/nnhr_nunu/status/2100926390078169405",
  },
  {
    label: "Xのエゴサーチ支援Webサービス：エゴサ支援ツール(ぬ)",
    href: "https://nnhr-nunu.github.io/TwitterEgoSearch_Nu/",
  },
  {
    label: "心音配信に合わせて動く心臓ソフトウェア：StreamHeartbeat(ぬ)",
    href: "https://github.com/nnhr-nunu/StreamHeartbeat_Nu",
  },
  { label: "Slay the Spire 2 催眠術師Mod", href: "https://x.com/nnhr_nunu/status/2083033452128207076" },
] as const;

function External({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
      {href}
    </a>
  );
}

/** ホームの最下部。開発者情報と関連サービス（姉妹サービスと同じ内容・並び）。 */
export function DeveloperFooter() {
  return (
    <footer className="mx-auto w-full max-w-2xl px-4 pb-12 sm:px-6">
      <section className="rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-foreground">
        <h2 className="text-base font-semibold tracking-tight">開発者情報</h2>
        <div className="mt-4 space-y-2">
          <p className="font-medium">開発者：ぬぬはら（アブノーマル催眠音声制作者）</p>
          <p>
            Twitter：<External href="https://x.com/nnhr_nunu" />
          </p>
          <p>
            催眠音声チャンネル：<External href="https://www.youtube.com/@nnhr_nunu" />
          </p>
          <p>
            実写催眠チャンネル：<External href="https://www.youtube.com/channel/UCqYpbbypex0iOikcZRenxGA" />
          </p>
          <p>バグ報告はDMなどで頂けたら幸いです。</p>
        </div>
        <div className="mt-5 border-t border-border pt-5">
          <h3 className="font-medium">【開発した関連サービス】</h3>
          <ul className="mt-3 divide-y divide-border">
            {RELATED.map((item) => (
              <li key={item.href} className="space-y-0.5 py-3 first:pt-0 last:pb-0">
                <p>・{item.label}</p>
                <p>
                  <External href={item.href} />
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <p className="mt-4 text-center text-xs text-muted-foreground">TopicStream(ぬ)</p>
    </footer>
  );
}
