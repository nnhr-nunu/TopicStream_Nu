import { describe, expect, it } from "vitest";

import {
  mergePublicStreams,
  publicStreamFromLink,
  sortPublicStreams,
  type PublicStream,
} from "@/lib/stream-directory";

const STREAMS: PublicStream[] = [
  { id: "a", title: "月曜の雑談", streamer: "A", platform: "youtube", url: "https://www.youtube.com/watch?v=jfKfPfyJRdk", live: true, updatedAt: 3 },
  { id: "b", title: "夜話", streamer: "B", platform: "twitch", url: "https://www.twitch.tv/twitch", live: true, updatedAt: 2 },
  { id: "c", title: "余韻", streamer: "C", platform: "youtube", url: "https://www.youtube.com/watch?v=5qap5aO4i9A", live: false, updatedAt: 4 },
];

describe("配信一覧", () => {
  it("ライブを先に、新しい順にする", () => {
    const sorted = sortPublicStreams(STREAMS);
    expect(sorted[0]?.live).toBe(true);
    expect(sorted.at(-1)?.live).toBe(false);
  });

  it("設定で貼った配信URLは同じ一覧の一行になる", () => {
    const linked = publicStreamFromLink({
      url: "https://www.twitch.tv/nunu",
      title: "9月23日の雑談",
      streamer: "ぬぬはら",
    });
    expect(linked?.platform).toBe("twitch");
    expect(linked?.title).toBe("9月23日の雑談");
    const merged = mergePublicStreams(STREAMS, linked ? [linked] : []);
    expect(merged.some((stream) => stream.url.includes("twitch.tv/nunu"))).toBe(true);
  });

  it("同じ本配信URLは重ねて、個人ボードとしては増やさない", () => {
    const linked = publicStreamFromLink({
      url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
      title: "いまの枠",
      watchId: "share_demo",
    });
    const merged = mergePublicStreams(STREAMS, linked ? [linked] : []);
    const same = merged.filter((stream) => stream.url.includes("jfKfPfyJRdk"));
    expect(same).toHaveLength(1);
    expect(same[0]?.title).toBe("いまの枠");
    expect(same[0]?.watchId).toBe("share_demo");
    expect(same[0]?.live).toBe(true);
  });

  it("StudioのチャットURLも同じ動画として一覧に載る", () => {
    const linked = publicStreamFromLink({
      url: "https://studio.youtube.com/live_chat?is_popout=1&v=NUCX55gmkkM",
      title: "Studioの枠",
    });
    expect(linked?.id).toBe("linked_youtube_NUCX55gmkkM");
    expect(linked?.platform).toBe("youtube");
  });
});
