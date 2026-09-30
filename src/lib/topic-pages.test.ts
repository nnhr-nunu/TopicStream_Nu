import { describe, expect, it } from "vitest";

import { relatedTopicPages, topicPageBySlug, topicPageHref, topicPages, topicPageSlug } from "@/lib/topic-pages";

describe("topicPageSlug", () => {
  it("URL にそのまま使える短い英数字になる", () => {
    expect(topicPageSlug("休日の過ごし方")).toMatch(/^t[0-9a-z]{7}$/);
  });

  it("表記ゆれ（空白・全角・末尾の？）は同じ名前になる", () => {
    expect(topicPageSlug("休日の過ごし方？")).toBe(topicPageSlug(" 休日の過ごし方 "));
  });

  it("モードが違えば別の名前になる", () => {
    expect(topicPageSlug("やる気が出ない", "advice")).not.toBe(topicPageSlug("やる気が出ない"));
  });
});

describe("topicPages", () => {
  const pages = topicPages();

  it("同梱のお題からページができ、名前は重ならない", () => {
    expect(pages.length).toBeGreaterThan(50);
    expect(new Set(pages.map((page) => page.slug)).size).toBe(pages.length);
  });

  it("どのページも 3×3 を埋められるだけの語がある", () => {
    for (const page of pages) expect(page.topics.length, page.seed).toBeGreaterThanOrEqual(8);
  });

  it("名前からページを引ける。無い名前は null", () => {
    const page = pages[0]!;
    expect(topicPageBySlug(page.slug)?.seed).toBe(page.seed);
    expect(topicPageBySlug("nope")).toBeNull();
  });

  it("ページのあるお題だけリンク先を返す", () => {
    expect(topicPageHref("休日の過ごし方")).toBe(`/topics/${topicPageSlug("休日の過ごし方")}`);
    expect(topicPageHref("図鑑に無いお題だよ")).toBeNull();
  });
});

describe("relatedTopicPages", () => {
  it("自分以外の、同じモードのお題を返す", () => {
    const page = topicPageBySlug(topicPageSlug("休日の過ごし方"))!;
    const related = relatedTopicPages(page, 6);
    expect(related).toHaveLength(6);
    expect(related.every((other) => other.slug !== page.slug && other.mode === page.mode)).toBe(true);
    // 同じ分類（暮らし・季節）が先に来る
    expect(related[0]!.category).toBe(page.category);
  });
});
