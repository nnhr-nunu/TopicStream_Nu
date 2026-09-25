import { describe, expect, it } from "vitest";

import * as ops from "@/lib/board-ops";
import { normalizePrefs } from "@/lib/node-box";
import {
  boardTopics,
  buildShareExample,
  composeSharePost,
  tweetIntentUrl,
  weightedPostLength,
} from "@/lib/share-post";
import { emptyBoard } from "@/lib/storage";

const radial = normalizePrefs({ generationLayout: "radial", density: "comfortable" });

function expandedBoard(labels: string[]) {
  const board = ops.createRootBoard(emptyBoard("test"), "夏休み", radial);
  const rootId = board.nodes[0]!.id;
  const started = ops.beginExpand(board, rootId, labels.length, radial)!;
  return ops.fillExpand(started.board, rootId, started.childIds, labels, radial);
}

describe("X シェアの文面", () => {
  it("中心のテーマと最初に広げた話題を拾う", () => {
    const board = expandedBoard(["海", "花火", "宿題", "旅行"]);
    expect(boardTopics(board)).toEqual({ theme: "夏休み", topics: ["海", "花火", "宿題", "旅行"] });
  });

  it("文例は話題を 4 つまで並べる", () => {
    const board = expandedBoard(["A", "B", "C", "D", "E", "F", "G", "H"]);
    expect(buildShareExample(board)).toBe("「夏休み」から雑談ネタを広げてみました💬\nA・B・C・D ほか");
  });

  it("本文が空でもハッシュタグは必ず付く", () => {
    expect(composeSharePost("")).toBe("#TopicStreamぬ");
    expect(composeSharePost(" 今日の雑談 \n")).toBe("今日の雑談\n\n#TopicStreamぬ");
  });

  it("文例は 1 回の投稿に収まる", () => {
    const board = expandedBoard(["A", "B", "C", "D", "E", "F", "G", "H"]);
    const text = composeSharePost(buildShareExample(board));
    expect(weightedPostLength(text, true)).toBeLessThanOrEqual(280);
  });

  it("日本語は 2、URL は 23 で数える", () => {
    expect(weightedPostLength("abc", false)).toBe(3);
    expect(weightedPostLength("あいう", false)).toBe(6);
    expect(weightedPostLength("abc", true)).toBe(3 + 1 + 23);
  });

  it("intent URL に本文とリンクを載せる", () => {
    const url = new URL(tweetIntentUrl("本文\n#TopicStreamぬ", "https://example.com/"));
    expect(url.origin + url.pathname).toBe("https://x.com/intent/tweet");
    expect(url.searchParams.get("text")).toBe("本文\n#TopicStreamぬ");
    expect(url.searchParams.get("url")).toBe("https://example.com/");
  });
});
