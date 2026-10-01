import { describe, expect, it } from "vitest";

import { commentHeartCodes, parseChatComment, normalizeCellCode } from "@/lib/chat-parse";
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

  it("IDだけのコメントは反応対象で、ハート絵文字なしでもコードが残る", () => {
    expect(parseChatComment("4F").highlightCodes).toEqual(["4F"]);
    expect(parseChatComment("4Fが聞きたい").highlightCodes).toEqual(["4F"]);
    expect(parseChatComment("4F").heartCodes).toEqual([]);
  });

  it("全角の １Ｅ・１ｅ・１２Ｃ も半角と同じに拾う", () => {
    expect(parseChatComment("１Ｅ").highlightCodes).toEqual(["1E"]);
    expect(parseChatComment("１ｅが聞きたい").highlightCodes).toEqual(["1E"]);
    expect(parseChatComment("１２Ｃ　❤").heartCodes).toEqual(["12C"]);
    expect(parseChatComment("ＡＢＣ").highlightCodes).toEqual([]);
    expect(normalizeCellCode("３Ｆ")).toBe("3F");
  });

  it("コメント1件はカード1枚につき +1（ID＋❤でも二重に数えない）", () => {
    expect(commentHeartCodes(parseChatComment("3E"))).toEqual(["3E"]);
    expect(commentHeartCodes(parseChatComment("3E ❤"))).toEqual(["3E"]);
    expect(commentHeartCodes(parseChatComment("3E 4F 3E"))).toEqual(["3E", "4F"]);
    expect(commentHeartCodes(parseChatComment("❤", "1C"))).toEqual(["1C"]);
    expect(commentHeartCodes(parseChatComment("こんばんは", "1C"))).toEqual([]);
  });

  it("❤ や 好き はそのIDのハートにする", () => {
    expect(parseChatComment("3E ❤").heartCodes).toEqual(["3E"]);
    expect(parseChatComment("3E好き").heartCodes).toEqual(["3E"]);
    expect(parseChatComment("❤", "1C").heartCodes).toEqual(["1C"]);
    expect(parseChatComment("3Eが聞きたい").heartCodes).toEqual([]);
  });
});

describe("コードと紛れる書き方", () => {
  it("時間・単位・URL の中の英数字はコードにしない", () => {
    expect(parseChatComment("3h待った").codes).toEqual([]);
    expect(parseChatComment("2d前に見た").codes).toEqual([]);
    expect(parseChatComment("https://example.com/tag/3d/ 見て").codes).toEqual([]);
    expect(parseChatComment("@user_1e こんばんは").codes).toEqual([]);
    expect(parseChatComment("clover").hasHeart).toBe(false);
    expect(parseChatComment("love").hasHeart).toBe(true);
  });

  it("小文字でも、コードだけ・助詞やハートが続くときは拾う", () => {
    expect(parseChatComment("1e").codes).toEqual(["1E"]);
    expect(parseChatComment("1eが聞きたい").codes).toEqual(["1E"]);
    expect(parseChatComment("2f ❤").heartCodes).toEqual(["2F"]);
  });

  it("「3Dゲーム」「2Dアニメ」のような語は番号とみなさない", () => {
    expect(parseChatComment("3Dゲーム好き").codes).toEqual([]);
    expect(parseChatComment("2Dアニメ派").codes).toEqual([]);
    expect(parseChatComment("1Eが聞きたい").codes).toEqual(["1E"]);
  });

  it("「1Eｗｗ」「1E2F」も読む", () => {
    expect(parseChatComment("1Eｗｗｗ").codes).toEqual(["1E"]);
    expect(parseChatComment("1E2F").codes).toEqual(["1E", "2F"]);
  });
});

describe("配信URL", () => {
  it("Twitch のポップアウト・配信マネージャーから配信者名を取り、名前でないものは弾く", () => {
    expect(parseStreamUrl("https://www.twitch.tv/popout/nunuhara/chat?popout=")).toMatchObject({
      kind: "twitch",
      channel: "nunuhara",
    });
    expect(parseStreamUrl("https://dashboard.twitch.tv/u/nunuhara/stream-manager")).toMatchObject({
      channel: "nunuhara",
    });
    expect(parseStreamUrl("twitch.tv/n")).toBeNull();
    expect(parseStreamUrl("https://www.twitch.tv/directory")).toBeNull();
    expect(parseStreamUrl("https://www.youtube.com/embed/live_stream?channel=UCxxxx")).toBeNull();
  });

  it("YouTubeとTwitchを読み取る", () => {
    expect(parseStreamUrl("https://www.youtube.com/watch?v=jfKfPfyJRdk")).toEqual({
      kind: "youtube",
      videoId: "jfKfPfyJRdk",
      url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
    });
    expect(parseStreamUrl("https://youtu.be/jfKfPfyJRdk")).toMatchObject({
      kind: "youtube",
      videoId: "jfKfPfyJRdk",
    });
    expect(parseStreamUrl("https://www.twitch.tv/nunu")).toMatchObject({ kind: "twitch", channel: "nunu" });
    expect(parseStreamUrl("not-a-url")).toBeNull();
  });

  it("Studioのライブ配信ページとチャットポップアウトから同じ動画IDを取る", () => {
    const liveChat = "https://studio.youtube.com/live_chat?is_popout=1&v=NUCX55gmkkM";
    const livestreaming = "https://studio.youtube.com/video/NUCX55gmkkM/livestreaming";
    expect(parseStreamUrl(liveChat)).toEqual({
      kind: "youtube",
      videoId: "NUCX55gmkkM",
      url: liveChat,
    });
    expect(parseStreamUrl(livestreaming)).toEqual({
      kind: "youtube",
      videoId: "NUCX55gmkkM",
      url: livestreaming,
    });
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
