import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/robots.txt/route";
import { AiNotice } from "@/components/ai-notice";
import { AI_NOTICE_EN, AI_NOTICE_JA, AI_TRAIN_BOTS, CONTENT_SIGNAL } from "@/lib/aiGuard";

afterEach(() => vi.unstubAllEnvs());

async function robotsTxt(env: { staticExport?: boolean; base?: string } = {}) {
  vi.stubEnv("STATIC_EXPORT", env.staticExport ? "1" : "");
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", env.base ?? "");
  const res = GET();
  expect(res.headers.get("content-type")).toContain("text/plain");
  return res.text();
}

describe("robots.txt", () => {
  it("AI の学習のボットを全部止め、検索の約束（Content-Signal）を付ける", async () => {
    const text = await robotsTxt();
    expect(text).toContain("User-agent: GPTBot\n");
    for (const bot of AI_TRAIN_BOTS) expect(text).toContain(`User-agent: ${bot}\n`);
    expect(text).toMatch(/User-agent: Scrapy\nDisallow: \/\n/);
    expect(text).toContain(`Content-Signal: ${CONTENT_SIGNAL}`);
    expect(text).toContain("Disallow: /_archive/");
  });

  it("今までの決まり（API・オーバーレイを止める、ほかは読ませる）と sitemap を残す", async () => {
    const all = (await robotsTxt()).split("User-agent: *\n")[1];
    expect(all).toContain("Allow: /\n");
    expect(all).toContain("Disallow: /api/\n");
    expect(all).toContain("Disallow: /overlay\n");
    expect(all).not.toMatch(/^Disallow: \/$/m);
    expect(all).toContain("Sitemap: https://topic-stream.oshilog.life/sitemap.xml");
  });

  it("キー無しデモ（静的エクスポート）は sitemap を載せず、basePath を付ける", async () => {
    const text = await robotsTxt({ staticExport: true, base: "/TopicStream_Nu" });
    expect(text).not.toContain("Sitemap:");
    expect(text).toContain("Disallow: /TopicStream_Nu/api/\n");
    expect(text).toContain("Disallow: /TopicStream_Nu/overlay\n");
    expect(text).toContain("User-agent: GPTBot\n");
  });
});

describe("ページの中の AI 向けの案内", () => {
  it("人の目・読み上げ・検索の抜粋に出さず、案内とおとりのリンクを置く", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");
    const html = renderToStaticMarkup(createElement(AiNotice));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("data-nosnippet");
    expect(html).not.toContain("display:none");
    expect(html).toContain("clip-path:inset(50%)");
    expect(html).toContain(AI_NOTICE_JA);
    expect(html).toContain(AI_NOTICE_EN.replace(/"/g, "&quot;"));
    expect(html).toContain('<a href="/_archive/" rel="nofollow" tabindex="-1">archive</a>');
  });

  it("おとりのリンクに basePath を付ける", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/TopicStream_Nu");
    expect(renderToStaticMarkup(createElement(AiNotice))).toContain('href="/TopicStream_Nu/_archive/"');
  });
});
