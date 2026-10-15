import { RELATED_SERVICES } from "@/components/related-services";
import { SiteLinks } from "@/components/site-links";

const LINK = "break-all text-primary underline-offset-2 hover:underline";

function External({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
      {href}
    </a>
  );
}

/** ホームの最下部。開発者情報と関連サービス（一覧は related-services.ts。正本から書き写す）。 */
export function DeveloperFooter() {
  return (
    <footer className="w-full pb-12">
      <section className="rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-foreground">
        <h2 className="text-base font-semibold tracking-tight">開発者情報</h2>
        <div className="mt-4 space-y-2">
          <p className="font-medium">開発者：ぬぬはら（催眠音声制作者）</p>
          <p>
            X：<External href="https://x.com/nnhr_nunu" />
          </p>
          <p>
            催眠音声チャンネル：<External href="https://www.youtube.com/@nnhr_nunu" />
          </p>
          <p>
            実写催眠チャンネル：<External href="https://www.youtube.com/channel/UCqYpbbypex0iOikcZRenxGA" />
          </p>
          <p>バグ報告はDMなどでいただけたら幸いです。</p>
        </div>
        <div className="mt-5 border-t border-border pt-5">
          <h3 className="font-medium">【開発した関連サービス】</h3>
          <ul className="mt-3 divide-y divide-border">
            {RELATED_SERVICES.map((item) => (
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
      <SiteLinks className="mt-4" />
      <p className="mt-2 text-center text-xs text-muted-foreground">TopicStream(ぬ)</p>
    </footer>
  );
}
