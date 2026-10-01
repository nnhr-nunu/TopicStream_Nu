import { describe, expect, it } from "vitest";

import { streamerFromUrl } from "@/lib/stream-url";

describe("streamerFromUrl", () => {
  it("Twitch はチャンネル名を配信者名にする（ポップアウトのチャットも）", () => {
    expect(streamerFromUrl("https://www.twitch.tv/nunuhara_")).toBe("nunuhara_");
    expect(streamerFromUrl("twitch.tv/popout/nunuhara_/chat")).toBe("nunuhara_");
  });

  it("YouTube の URL には名前が無いので空（サーバーが調べる）", () => {
    expect(streamerFromUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("");
  });

  it("配信の URL でなければ空", () => {
    expect(streamerFromUrl("")).toBe("");
    expect(streamerFromUrl("https://www.twitch.tv/directory")).toBe("");
  });
});
