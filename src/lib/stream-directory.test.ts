import { describe, expect, it } from "vitest";

import {
  mergePublicStreams,
  publicStreamFromLink,
  SEED_PUBLIC_STREAMS,
  sortPublicStreams,
} from "@/lib/stream-directory";

describe("配信一覧", () => {
  it("ライブを先に、新しい順にする", () => {
    const sorted = sortPublicStreams(SEED_PUBLIC_STREAMS);
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
    const merged = mergePublicStreams(SEED_PUBLIC_STREAMS, linked ? [linked] : []);
    expect(merged.some((stream) => stream.url.includes("twitch.tv/nunu"))).toBe(true);
  });

  it("同じ本配信URLは重ねて、個人ボードとしては増やさない", () => {
    const linked = publicStreamFromLink({
      url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
      title: "いまの枠",
      watchId: "share_demo",
    });
    const merged = mergePublicStreams(SEED_PUBLIC_STREAMS, linked ? [linked] : []);
    const same = merged.filter((stream) => stream.url.includes("jfKfPfyJRdk"));
    expect(same).toHaveLength(1);
    expect(same[0]?.title).toBe("いまの枠");
    expect(same[0]?.watchId).toBe("share_demo");
    expect(same[0]?.live).toBe(true);
  });
});
