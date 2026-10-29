import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listStreams, saveStream } from "@/lib/community-server";

/** Upstash の REST を真似て、送られたコマンドを記録する */
function fakeRedis(store: Record<string, string>, hlen = 1) {
  const sent: string[][] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      const command = JSON.parse(init.body) as string[];
      sent.push(command);
      let result: unknown = null;
      if (command[0] === "HGETALL") result = Object.entries(store).flat();
      if (command[0] === "HGET") result = store[command[2]!] ?? null;
      if (command[0] === "HSET") {
        store[command[2]!] = command[3]!;
        result = 1;
      }
      if (command[0] === "HLEN") result = hlen;
      return { ok: true, status: 200, json: async () => ({ result }) };
    }),
  );
  return sent;
}

describe("配信一覧の Redis の読み書き", () => {
  beforeEach(() => {
    vi.stubEnv("KV_REST_API_URL", "https://redis.example");
    vi.stubEnv("KV_REST_API_TOKEN", "token");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("保存は 1 件の HGET・HSET と HLEN だけで、ボードの全件は読まない", async () => {
    const sent = fakeRedis({});
    const stream = await saveStream({ url: "https://www.twitch.tv/somebody" });
    expect(stream?.platform).toBe("twitch");
    expect(sent.map((c) => c[0])).toEqual(["HGET", "HSET", "HLEN"]);
    expect(sent.every((c) => c[1] === "tsc:streams")).toBe(true);
  });

  it("一覧は tsc:streams の HGETALL だけを読み、続けて呼ぶと読み直さない", async () => {
    const entry = {
      id: "stream_x",
      title: "t",
      streamer: "s",
      author: "s",
      platform: "twitch",
      url: "https://www.twitch.tv/other",
      live: true,
      updatedAt: Date.now(),
    };
    const sent = fakeRedis({ [entry.url]: JSON.stringify(entry) });
    const first = await listStreams();
    await listStreams();
    expect(first).toHaveLength(1);
    expect(sent).toEqual([["HGETALL", "tsc:streams"]]);
  });
});
