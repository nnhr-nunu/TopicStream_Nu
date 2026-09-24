import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AdScript } from "@/components/ad-script";
import { AdSlot } from "@/components/ad-slot";
import { SiteLinks } from "@/components/site-links";

export const metadata: Metadata = {
  title: "使い方 | TopicStream(ぬ)",
  description:
    "TopicStream(ぬ)の使い方。キーワードを1つ入れるだけで、雑談配信のネタが3×3のマップで広がります。コメント連動やOBS表示の方法も。",
};

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-foreground">
      {children}
    </section>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-semibold tracking-tight">{children}</h2>;
}

/** 画面上のボタンや用語。本文中で目立たせて、画面と見比べやすくする。 */
function Term({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-[0.95em] font-medium whitespace-nowrap">{children}</span>
  );
}

const USE_CASES: { title: string; body: ReactNode }[] = [
  {
    title: "雑談配信で話すことがなくなったとき",
    body: (
      <>
        「夏休みの思い出」「最近ハマっているもの」など、ざっくりしたキーワードを入れて <Term>始める</Term>{" "}
        を押します。関連する話題が9個出るので、気になったものをクリックすると、さらにそこから広がります。
      </>
    ),
  },
  {
    title: "枠のネタを前もって仕込んでおきたい",
    body: (
      <>
        配信前にマップを広げておき、話したい話題に <Term>ピン</Term>{" "}
        を付けておきます。付箋にひとこと書いておけば、本番で言いたいことを忘れません。
      </>
    ),
  },
  {
    title: "視聴者と一緒に話題を決めたい",
    body: (
      <>
        マップ下に配信の URL
        を貼ると、コメント欄と連動します。視聴者が「1Eが聞きたい」のようにマスの番号を書くと、そのマスが光ります。
      </>
    ),
  },
  {
    title: "配信画面に話題マップを映したい",
    body: (
      <>
        OBS のブラウザソースに <Term>/overlay/?transparent=1</Term>
        （1920×1080）を指定すると、背景が透明のマップを配信に重ねられます。
      </>
    ),
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "ログインや登録は必要ですか？",
    a: "必要ありません。開くだけですぐ使えます。",
  },
  {
    q: "作ったマップはどこに保存されますか？",
    a: "お使いのブラウザの中に自動保存されます。別のブラウザや端末には引き継がれません。",
  },
  {
    q: "話題はどうやって作られていますか？",
    a: "AI（Gemini）で作っています。AI が使えないときは、あらかじめ用意した話題から自動で作るので、止まることはありません。",
  },
  {
    q: "個人情報を書いても大丈夫ですか？",
    a: "書かないでください。ボードは公開されることがあります（「みんなのトークテーマ」や、いっしょに見る画面など）。",
  },
];

const SHORTCUTS: [string, string][] = [
  ["E", "選んだ話題を展開する"],
  ["G", "そのマスの文だけ作り直す"],
  ["Z / Y", "ひとつ戻る / 進む"],
  ["+ / -", "拡大 / 縮小"],
  ["0", "全体を表示する"],
];

export default function GuidePage() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-4 px-4 py-10 sm:px-6">
      <AdScript />
      <div className="space-y-2 px-1">
        <p className="text-sm">
          <Link href="/" className="text-primary underline-offset-2 hover:underline">
            ← TopicStream(ぬ)
          </Link>
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">使い方</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          雑談配信のための話題マインドマップです。キーワードを1つ入れると、3×3（マンダラート）で関連する話題が広がります。
        </p>
      </div>

      <Card>
        <Heading>基本は3ステップ</Heading>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            ホームでキーワードを入れて <Term>始める</Term>（サイコロのボタンなら思いつかなくても OK）
          </li>
          <li>気になる話題をクリック。そこを中心に、新しい 3×3 が広がる</li>
          <li>
            話したい話題に <Term>ピン</Term> や <Term>付箋</Term> を付けて、配信で使う
          </li>
        </ol>
        <p className="text-muted-foreground">
          カードにカーソルを合わせると、♡（お気に入り）や 📝（付箋）などのメニューが出ます。
        </p>
      </Card>

      <Card>
        <Heading>こんなときに便利</Heading>
        <div className="divide-y divide-border">
          {USE_CASES.map((item) => (
            <div key={item.title} className="space-y-1.5 py-4 first:pt-1 last:pb-1">
              <h3 className="font-semibold">{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Heading>ショートカットキー</Heading>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
          {SHORTCUTS.map(([key, label]) => (
            <div key={key} className="contents">
              <dt>
                <Term>{key}</Term>
              </dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <Heading>よくある質問</Heading>
        <dl className="divide-y divide-border">
          {FAQS.map((item) => (
            <div key={item.q} className="space-y-1 py-3 first:pt-1 last:pb-1">
              <dt className="font-semibold">Q. {item.q}</dt>
              <dd>{item.a}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Link
        href="/"
        className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-6 text-base font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        さっそく使ってみる
      </Link>

      <div className="-mx-4 sm:-mx-6">
        <AdSlot />
      </div>

      <SiteLinks />
    </div>
  );
}
