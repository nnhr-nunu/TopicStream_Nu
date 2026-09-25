import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "プライバシーポリシー | TopicStream(ぬ)",
  description: "TopicStream(ぬ)の広告・Cookie・保存データの扱いについて。",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all text-primary underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-4 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">プライバシーポリシー</h1>

      <div className="space-y-6 rounded-xl border border-border bg-card p-4 text-foreground">
        <Section title="ブラウザに保存されるもの">
          <p>
            作成したボード、お気に入り、付箋、ニックネーム、設定、自分の話題の記録（トピック図鑑の「自分の記録」）は、お使いのブラウザの localStorage
            に保存されます。ニックネームは任意で、本名を入れる必要はありません。
          </p>
        </Section>

        <Section title="サーバーに送られるもの">
          <p>次の機能を使ったときは、内容が運営者のサーバーに送られます。</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              話題の生成：入力したキーワードや話題の文言が、生成 AI（Google Gemini API）に送られます。Google
              による取り扱いは Google の規約に従います。
            </li>
            <li>人気のトピックの集計：始めたキーワードや展開した話題の文言が、集計のために送られます。</li>
            <li>
              トピック図鑑：AI が話題を作ったとき、そのキーワードと出てきた話題が名前なしで記録され、ほかの人の候補や
              <Link href="/topics/" className="underline underline-offset-2">
                トピック図鑑
              </Link>
              に使われます。図鑑の一覧には、2回以上使われたキーワードだけが載ります。
            </li>
            <li>
              「いっしょに見る」やテーマの公開：共有したボードとニックネームが保存され、URL を知っている人が見られます。
            </li>
            <li>配信一覧：URL を貼った配信のタイトル・配信者名・URL が一覧に載ります。</li>
          </ul>
          <p>ボードは公開されることがあるので、個人情報は書かないでください。</p>
        </Section>

        <Section title="広告について">
          <p>
            当ツールは第三者配信の広告サービス「Google AdSense」を利用しています。Google
            などの第三者配信事業者は Cookie を使用して、ユーザーが当サイトや他のサイトに過去にアクセスした際の情報に基づいて広告を配信します。
          </p>
          <p>
            Google が広告 Cookie を使用することにより、ユーザーが当サイトや他のサイトにアクセスした際の情報に基づいて、Google
            やそのパートナーが適切な広告をユーザーに表示できます。
          </p>
          <p>
            パーソナライズ広告は
            <ExternalLink href="https://adssettings.google.com/">Google の広告設定</ExternalLink>
            で無効にできます。また、
            <ExternalLink href="https://www.aboutads.info/">www.aboutads.info</ExternalLink>
            にアクセスすれば、第三者配信事業者の Cookie を無効にできます。
          </p>
          <p>
            Google によるデータの利用については
            <ExternalLink href="https://policies.google.com/technologies/partner-sites">
              Google のポリシーと規約
            </ExternalLink>
            をご覧ください。
          </p>
          <p>広告は、ホーム・みんなのトークテーマ・使い方のページにのみ表示され、配信用のオーバーレイには表示されません。</p>
        </Section>

        <Section title="お問い合わせ">
          <p>
            ご質問は X（<ExternalLink href="https://x.com/nnhr_nunu">@nnhr_nunu</ExternalLink>）の DM までお願いします。
          </p>
        </Section>

        <p className="text-xs text-muted-foreground">制定日：2026年9月25日</p>
      </div>

      <p className="text-center text-sm">
        <Link href="/" className="text-primary underline-offset-2 hover:underline">
          ← TopicStream(ぬ)に戻る
        </Link>
      </p>
    </div>
  );
}
