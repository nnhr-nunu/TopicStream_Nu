import { describe, expect, it } from "vitest";

import { markDetail } from "@/lib/board-ops";
import { DETAIL_LABEL_MAX, LABEL_MAX } from "@/lib/constants";
import { mockDetailTopics } from "@/lib/detail-modes";
import { buildPrompt, padTopics, parseTopics } from "@/lib/gemini-core";
import type { Board } from "@/lib/types";

describe("具体的にする", () => {
  it("答えは文なので長めに残し、文の中の「」や読点で切らない", () => {
    const answer = "「どうしたい？」と自分に聞いて、紙に書き出してみよう";
    expect(parseTopics(JSON.stringify([answer]), "本当はどうしたい？", [], true)).toEqual([answer]);
    // 途中までしか届いていない配列でも、かぎかっこの中身だけを語として拾わない
    expect(parseTopics(`["${answer}", "書きかけ`, "お題", [], true)).toEqual([answer]);
    expect(parseTopics(JSON.stringify([answer]), "お題", [])[0]!.length).toBeLessThanOrEqual(LABEL_MAX);
  });

  it("長すぎる答えは上限で切る", () => {
    const long = "あ".repeat(80);
    expect(padTopics([], [long], 1, "お題", true)[0]!.length).toBe(DETAIL_LABEL_MAX);
  });

  it("モードごとの指示とオフラインの答えを出す", () => {
    expect(buildPrompt("一番つらい瞬間", [], 8, ["仕事を辞めたい"], "advice", true)).toContain("〜してみる");
    expect(buildPrompt("一番つらい瞬間", [], 8, [], "advice", true)).toContain("読点");
    expect(buildPrompt("夜食", [], 8, [], "chat", true)).toContain("体言止め");
    const offline = mockDetailTopics("一番つらい瞬間", [], 8, "advice", ["仕事を辞めたい"], () => 0);
    expect(offline).toHaveLength(8);
    expect(offline[0]).toContain("仕事を辞めたい");
    expect(offline.some((text) => /しよう|どう？/.test(text))).toBe(false);
    expect(offline.every((text) => text.length <= DETAIL_LABEL_MAX)).toBe(true);
    const chat = mockDetailTopics("夜食", [], 8, "chat");
    expect(chat).toHaveLength(8);
    expect(chat).toContain("夜食の失敗談");
  });

  it("空のカードにだけ答えの印を付ける（中央の写しには付けない）", () => {
    const node = (id: string, placeholder: boolean) => ({
      id,
      position: { x: 0, y: 0 },
      data: { label: id, memo: "", parentId: "p", expanded: false, expanding: false, depth: 1, appearIndex: 0, placeholder },
    });
    const board = { nodes: [node("copy", false), node("a", true), node("other", true)] } as unknown as Board;
    const marked = markDetail(board, ["copy", "a"]);
    expect(marked.nodes.map((item) => Boolean(item.data.detail))).toEqual([false, true, false]);
  });
});
