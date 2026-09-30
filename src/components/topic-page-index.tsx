import Link from "next/link";

import { MODE_PRESETS } from "@/lib/modes";
import { CATEGORIES } from "@/lib/topic-knowledge";
import { topicPages, type TopicPage } from "@/lib/topic-pages";

function Group({ title, pages }: { title: string; pages: TopicPage[] }) {
  if (pages.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {pages.map((page) => (
          <li key={page.slug}>
            <Link href={`/topics/${page.slug}`} className="home-topic-chip inline-block">
              {page.seed}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * お題ごとのページへのリンク集。図鑑の中身は読み込んだあとに出るので、
 * 最初の HTML にも（検索エンジンにも）お題が届くよう、サーバー側で書き出す
 */
export function TopicPageIndex() {
  const pages = topicPages();
  const chat = pages.filter((page) => page.mode === "chat");
  return (
    <section className="mt-10 space-y-4" aria-labelledby="topic-page-index">
      <h2 id="topic-page-index" className="text-lg font-bold tracking-tight">
        お題の一覧
      </h2>
      {CATEGORIES.map((category) => (
        <Group
          key={category.id}
          title={category.label}
          pages={chat.filter((page) => page.category === category.id)}
        />
      ))}
      {MODE_PRESETS.filter((preset) => preset.id !== "chat").map((preset) => (
        <Group key={preset.id} title={`${preset.label}モード`} pages={pages.filter((page) => page.mode === preset.id)} />
      ))}
    </section>
  );
}
