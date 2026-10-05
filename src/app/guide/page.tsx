import type { ResolvingMetadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AdScript } from "@/components/ad-script";
import { AdSlot } from "@/components/ad-slot";
import { AiKeySteps } from "@/components/ai-key-steps";
import { CreditNotice } from "@/components/credit-notice";
import { SiteLinks } from "@/components/site-links";
import { UsageGallery } from "@/components/usage-gallery";
import { pageMetadata } from "@/lib/page-metadata";

export function generateMetadata(_: unknown, parent: ResolvingMetadata) {
  return pageMetadata(parent, {
    path: "/guide",
    title: "使い方 | TopicStream(ぬ)",
    description:
      "TopicStream(ぬ)の使い方。キーワードを1つ入れるだけで、雑談配信のネタが3×3のマップで広がります。コメント連動やOBS表示の方法も。",
  });
}

function Card({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <section
      id={id}
      className="scroll-mt-6 space-y-3 rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-foreground"
    >
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
        を押します。関連する話題が 8 個出るので、気になったものをクリックすると、さらにそこから広がります。
      </>
    ),
  },
  {
    title: "枠のネタを前もって仕込んでおきたい",
    body: (
      <>
        配信前にマップを広げておき、話したい話題に <Term>♡</Term>{" "}
        を付けておきます（ルーレットでも当たりやすくなります）。付箋にひとこと書いておけば、本番で言いたいことを忘れません。
      </>
    ),
  },
  {
    title: "視聴者と一緒に話題を決めたい",
    body: (
      <>
        マップ下の <Term>配信と連携</Term> に配信の URL を貼ると、コメントと連動します。視聴者が「1Eが聞きたい」のようにカードの番号を書くと、そのカードが光ってハートが
        1 つ増えます。「お題:〇〇」と書くと <Term>お題箱</Term>{" "}
        に届き、押すとそのお題がカードになって広がります。
      </>
    ),
  },
  {
    title: "配信画面に話題マップを映したい",
    body: (
      <>
        OBS のウィンドウキャプチャで、このページを開いたブラウザをそのまま映すのがいちばん手軽です。
        マップ右上の「いっしょに見るリンク」を OBS のブラウザソースに入れると、手元の操作に合わせて動くマップだけを映せます。
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
    a: "お使いのブラウザの中に自動保存されます。別のブラウザや端末で続きをしたいときは、設定（歯車のボタン）の「別の端末へ引き継ぐ」でコードを作り、新しい端末でそのコードを入れると運べます。",
  },
  {
    q: "話題はどうやって作られていますか？",
    a: "AI（Gemini）で作っています。AI が使えないときは、あらかじめ用意した話題から自動で作るので、止まることはありません。",
  },
  {
    q: "「AI の利用上限に達しました」と出ます。",
    a: "AI はみんなで 1 つの無料枠を分け合っているので、混む時間は使い切ってしまうことがあります。時間を置くか、このページの「自分の AI キーを入れる」の手順で自分のキー（無料）を入れると、自分の枠で続けられます。",
  },
  {
    q: "配信や動画で使ってもいいですか？",
    a: "はい。使ったときは、概要欄などにこのページ下のクレジットを書いていただけるとうれしいです。",
  },
  {
    q: "個人情報を書いても大丈夫ですか？",
    a: "書かないでください。よく使ったマップは付箋を外して「みんなが作った話題マップ」に載ることがあり、いっしょに見る画面でも公開されます。",
  },
];

const SHORTCUTS: [string, string][] = [
  ["E", "選んだカードを広げる"],
  ["N", "話題ルーレット（まだ話していないカードから次の話題を選ぶ）"],
  ["P", "選んだ話題を NOW（今の話題）にする"],
  ["G", "選んだカードだけ作り直す"],
  ["C", "選んだカードの言葉をコピーする"],
  ["R", "新しいお題をマップに足す"],
  ["Z / Y", "1つ戻る / 進む"],
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
        <Heading>できること</Heading>
        <UsageGallery />
      </Card>

      <Card>
        <Heading>基本は3ステップ</Heading>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            ホームでキーワードを入れて <Term>始める</Term>（サイコロのボタンなら思いつかなくても OK）
          </li>
          <li>気になる話題をクリック。そこを中心に、新しい 3×3 が広がる</li>
          <li>
            話す話題を <Term>NOW</Term> にして、配信で使う（言いたいことは <Term>付箋</Term> に）
          </li>
        </ol>
        <p className="text-muted-foreground">
          次に何を話すか迷ったら、左下の <Term>ルーレット</Term>（N キー）。まだ話していないカードの中から 1 枚を選んで
          NOW にします。コメントでハートが多く付いたカードほど当たりやすくなります。NOW を別のカードへ移すと、前のカードには{" "}
          <Term>話した</Term> の印が付き、上の帯には今の話題を話している時間が出ます。
        </p>
        <p className="text-muted-foreground">
          カードのメニュー（スマホは長押し）には、NOW・📝（付箋）・作り直し・<Term>解説</Term>
          （言葉の短い解説を付箋に貼る）などがあります。
          「で、どうすればいい？」と思ったら <Term>具体化</Term>{" "}
          で、具体的な話題（雑談）・対応策（お悩み相談）・企画案（アイデア出し）・行動（目標）などを 8 つ出せます。
          左下の切り替えを <Term>具体化</Term>{" "}
          にすると、カードをタップするだけでこれが動きます。
        </p>
        <p className="text-muted-foreground">
          カードを別のカードに重ねると <Term>掛け合わせ</Term>{" "}
          になり、2つを組み合わせた話題（例「ゲーム × 料理」）が広がります（スマホは長押ししたまま動かす）。
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

      <Card id="ai-key">
        <Heading>自分の AI キーを入れる（無料）</Heading>
        <p>
          話題を作る AI（Google の Gemini）は、TopicStream を使うみんなで 1 つの無料枠を分け合っています。
          使う人が多い時間は枠が尽きて、「AI の利用上限に達しました」と出ることがあります。
        </p>
        <p>
          そんなときは、自分用のキー（API キー）を作って入れると、自分だけの枠で使えます。作るのは無料で、5
          分ほどです。入れなくても、これまでどおり使えます。
        </p>
        <AiKeySteps detailed />
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

      <Card id="credit">
        <Heading>配信・動画で使うとき（クレジット表記のお願い）</Heading>
        <p>
          配信や動画で TopicStream(ぬ) を使っていただいたときは、概要欄などに次のクレジットを書いていただけるとうれしいです。
        </p>
        <CreditNotice />
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
