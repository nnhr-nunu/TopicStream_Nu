import type { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, ChevronRight, MousePointerClick, Radio, Sparkles, StickyNote } from "lucide-react";

import { AdScript } from "@/components/ad-script";
import { AdSlot } from "@/components/ad-slot";
import { SiteLinks } from "@/components/site-links";
import { TopicPageMandala, TopicStartButton } from "@/components/topic-page-start";
import { modePreset } from "@/lib/modes";
import { pageMetadata } from "@/lib/page-metadata";
import { canonicalUrl } from "@/lib/site-url";
import { categoryLabel } from "@/lib/topic-knowledge";
import { relatedTopicPages, topicPageBySlug, topicPages, type TopicPage } from "@/lib/topic-pages";
import type { BoardMode } from "@/lib/types";

import "../../topic-page.css";

// 同梱のお題のぶんだけ、ビルド時に書き出す（静的エクスポートでも同じページが出る）
export const dynamicParams = false;

export function generateStaticParams() {
  return topicPages().map((page) => ({ slug: page.slug }));
}

type Props = { params: Promise<{ slug: string }> };

/** モードごとの言い回し（雑談は「ネタ」、ほかは「切り口」） */
const COPY: Record<BoardMode, { heading: (seed: string) => string; unit: string; lead: (seed: string) => string; list: string }> = {
  chat: {
    heading: (seed) => `「${seed}」で話せる雑談ネタ`,
    unit: "選",
    lead: (seed) =>
      `配信や雑談で「${seed}」を話すときの切り口を集めました。気になるネタは、そのまま話題マップにして AI でさらに広げられます。`,
    list: "雑談ネタ",
  },
  advice: {
    heading: (seed) => `「${seed}」を整理する切り口`,
    unit: "個",
    lead: (seed) =>
      `「${seed}」と感じたときに、状況や気持ちを分けて考えるための切り口です。ひとつずつ広げると、次の一歩が見えてきます。`,
    list: "考える切り口",
  },
  idea: {
    heading: (seed) => `「${seed}」のアイデアを広げる切り口`,
    unit: "個",
    lead: (seed) => `「${seed}」を考えるときの発想の切り口です。ひとつ選んで広げると、企画の形まで進められます。`,
    list: "発想の切り口",
  },
  goal: {
    heading: (seed) => `「${seed}」を達成するための要素`,
    unit: "個",
    lead: (seed) =>
      `「${seed}」という目標を、要素に分けたものです。マンダラートで広げると、今日やることまで落とし込めます。`,
    list: "目標の要素",
  },
  review: {
    heading: (seed) => `「${seed}」を振り返る切り口`,
    unit: "個",
    lead: (seed) =>
      `「${seed}」を振り返るときの問いです。よかったこと・困ったことから、次に試すことを見つけられます。`,
    list: "振り返りの切り口",
  },
  learn: {
    heading: (seed) => `「${seed}」を調べる切り口`,
    unit: "個",
    lead: (seed) => `「${seed}」を知るための入口です。基本・例・比較に分けて広げると、次に調べることが見つかります。`,
    list: "調べる切り口",
  },
};

function pageTitle(page: TopicPage): string {
  const copy = COPY[page.mode];
  return `${copy.heading(page.seed)} ${page.topics.length}${copy.unit}`;
}

export async function generateMetadata({ params }: Props, parent: ResolvingMetadata): Promise<Metadata> {
  const page = topicPageBySlug((await params).slug);
  if (!page) return {};
  return pageMetadata(parent, {
    path: `/topics/${page.slug}`,
    title: `${pageTitle(page)} | TopicStream(ぬ)`,
    description: `${page.topics.slice(0, 5).join("、")}など、「${page.seed}」の${COPY[page.mode].list}を ${page.topics.length} 個。押すだけで 3×3 の話題マップになり、AI でさらに広げられます。登録不要・無料。`,
    type: "article",
  });
}

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default async function TopicPageRoute({ params }: Props) {
  const page = topicPageBySlug((await params).slug);
  if (!page) notFound();
  const copy = COPY[page.mode];
  const preset = modePreset(page.mode);
  const related = relatedTopicPages(page, 6);
  const start = { seed: page.seed, topics: page.topics, mode: page.mode };
  const steps = [
    {
      icon: <Sparkles />,
      title: "「このお題で始める」を押す",
      body: "上の 3×3 が、そのまま自分のマップになります。登録もインストールも要りません。",
    },
    {
      icon: <MousePointerClick />,
      title: "気になるカードを押す",
      body: "そのカードを中心に、AI が新しい話題を 8 つ広げます。話が尽きるまで何度でも。",
    },
    page.mode === "chat"
      ? {
          icon: <Radio />,
          title: "話すカードを NOW にする",
          body: "今の話題が大きく出ます。配信に映したり、コメント欄と連動させたりもできます。",
        }
      : {
          icon: <StickyNote />,
          title: "付箋にひとこと残す",
          body: "考えたこと・決めたことをカードに貼っておけます。あとから見返すのも簡単です。",
        },
  ];
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "TopicStream(ぬ)", item: canonicalUrl("") },
      { "@type": "ListItem", position: 2, name: "トピック図鑑", item: canonicalUrl("/topics") },
      { "@type": "ListItem", position: 3, name: page.seed, item: canonicalUrl(`/topics/${page.slug}`) },
    ],
  };

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-4 py-8" data-mode={page.mode}>
      <AdScript />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      <header>
        <Link href="/" className="app-crumb-home w-fit" aria-label="TopicStream(ぬ) のホームへ">
          {/* eslint-disable-next-line @next/next/no-img-element -- 静的エクスポート（Pages）でも同じパスで出すため */}
          <img src={`${base}/topicstream-logo.svg`} alt="" width={26} height={26} className="size-[26px] shrink-0 rounded-lg" />
          <span className="text-sm font-semibold tracking-tight">
            TopicStream<span className="ml-0.5 text-xs font-medium text-muted-foreground">(ぬ)</span>
          </span>
        </Link>
        <nav aria-label="パンくず" className="mt-5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Link href="/topics" className="underline-offset-2 hover:underline">
            トピック図鑑
          </Link>
          <ChevronRight className="size-3" aria-hidden />
          <span>
            {preset.label}・{categoryLabel(page.category)}
          </span>
        </nav>
        <h1 className="mt-3 text-2xl leading-snug font-bold tracking-tight sm:text-3xl">
          {copy.heading(page.seed)}{" "}
          <span className="whitespace-nowrap text-primary">
            {page.topics.length}
            {copy.unit}
          </span>
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{copy.lead(page.seed)}</p>
      </header>

      <section className="home-showcase mt-6 flex flex-col items-center gap-4">
        <TopicPageMandala {...start} />
        <TopicStartButton {...start}>
          <Sparkles aria-hidden />
          このお題で始める
        </TopicStartButton>
        <p className="text-center text-xs leading-5 text-muted-foreground">
          登録なし・無料。
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold tracking-tight">
          「{page.seed}」の{copy.list}一覧
        </h2>
        <ol className="topic-page-list mt-3">
          {page.topics.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold tracking-tight">ここから、話題はいくらでも広がります</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-border bg-card p-4">
              <p className="flex items-center gap-2 text-xs font-bold text-primary [&_svg]:size-4">
                {step.icon}
                STEP {index + 1}
              </p>
              <h3 className="mt-2 text-sm font-semibold">{step.title}</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <TopicStartButton {...start}>
            <Sparkles aria-hidden />
            このお題で始める
          </TopicStartButton>
          <Link href="/" className="home-showcase-more">
            自分のお題を入れて始める
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      {related.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-bold tracking-tight">近いお題</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {related.map((other) => (
              <li key={other.slug}>
                <Link href={`/topics/${other.slug}`} className="home-topic-card">
                  <span className="text-sm leading-6 font-semibold">{other.seed}</span>
                  <span className="mt-1 text-xs leading-5 text-muted-foreground">
                    {other.topics.slice(0, 3).join("・")} ほか
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-center">
            <Link href="/topics" className="home-showcase-more">
              <BookOpen className="size-4" aria-hidden />
              トピック図鑑でほかのお題を探す
            </Link>
          </p>
        </section>
      ) : null}

      <div className="mt-10">
        <AdSlot />
      </div>
      <SiteLinks className="mt-2" />
    </div>
  );
}
