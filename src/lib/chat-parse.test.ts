import { describe, expect, it } from "vitest";

import { parseChatComment, normalizeCellCode } from "@/lib/chat-parse";
import { nextBoardName, todayBoardName } from "@/lib/ids";
import { parseStreamUrl } from "@/lib/stream-url";

describe("コメントのID", () => {
  it("3Eが聞きたい・3E！・3e を拾い、無関係な文は無視する", () => {
    expect(parseChatComment("3Eが聞きたい").highlightCodes).toEqual(["3E"]);
    expect(parseChatComment("3E！").highlightCodes).toEqual(["3E"]);
    expect(parseChatComment("3e").highlightCodes).toEqual(["3E"]);
    expect(parseChatComment("今日も配信ありがとう").highlightCodes).toEqual([]);
    expect(parseChatComment("33").highlightCodes).toEqual([]);
    expect(normalizeCellCode("3e")).toBe("3E");
  });

  it("❤ や 好き はそのIDのハートにする", () => {
    expect(parseChatComment("3E ❤").heartCodes).toEqual(["3E"]);
    expect(parseChatComment("3E好き").heartCodes).toEqual(["3E"]);
    expect(parseChatComment("❤", "1C").heartCodes).toEqual(["1C"]);
    expect(parseChatComment("3Eが聞きたい").heartCodes).toEqual([]);
  });
});

describe("配信URL", () => {
  it("YouTubeとTwitchを読み取る", () => {
    expect(parseStreamUrl("https://www.youtube.com/watch?v=jfKfPfyJRdk")).toEqual({
      kind: "youtube",
      videoId: "jfKfPfyJRdk",
      url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
    });
    expect(parseStreamUrl("https://www.twitch.tv/nunu")).toMatchObject({ kind: "twitch", channel: "nunu" });
    expect(parseStreamUrl("not-a-url")).toBeNull();
  });
});

describe("ボード名", () => {
  it("今日の雑談、被ったら新しいボード", () => {
    const today = todayBoardName(new Date("2026-09-23T00:00:00"));
    expect(today).toBe("9月23日の雑談");
    expect(nextBoardName([today], new Date("2026-09-23T00:00:00"))).toBe("新しいボード");
    expect(nextBoardName([today, "新しいボード"], new Date("2026-09-23T00:00:00"))).toBe("新しいボード 2");
  });
});
