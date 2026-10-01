import { describe, expect, it } from "vitest";

import { allowedModel } from "@/lib/gemini-guard";
import { saveShare, getShare } from "@/lib/live-store";
import { createRateLimit } from "@/lib/rate-limit";
import type { Board } from "@/lib/types";

describe("公開の書き込み口の回数制限", () => {
  it("時間内の回数を超えたら断り、時間が過ぎたらまた通す", () => {
    let now = 0;
    const allow = createRateLimit(2, 1_000, () => now);
    expect(allow("a")).toBe(true);
    expect(allow("a")).toBe(true);
    expect(allow("a")).toBe(false);
    expect(allow("b")).toBe(true);
    now = 1_001;
    expect(allow("a")).toBe(true);
  });

  it("まとめて数える（票を 100 件まとめて送る等）", () => {
    const allow = createRateLimit(10, 1_000, () => 0);
    expect(allow("a", 8)).toBe(true);
    expect(allow("a", 3)).toBe(false);
    expect(allow("a", 2)).toBe(true);
  });
});

describe("サーバーのキーで使うモデル", () => {
  it("決めたモデル以外はサーバーのキーでは使わない（自分のキーなら使える）", () => {
    expect(allowedModel("gemini-3.6-flash", false)).toBe("gemini-3.6-flash");
    expect(allowedModel("gemini-9-ultra", false)).toBe("gemini-3.5-flash-lite");
    expect(allowedModel("gemini-9-ultra", true)).toBe("gemini-9-ultra");
    expect(allowedModel("../../evil", true)).toBe("gemini-3.5-flash-lite");
    expect(allowedModel(undefined, false)).toBe("gemini-3.5-flash-lite");
  });
});

describe("いっしょに見るリンク", () => {
  const board: Board = {
    id: "b1",
    name: "雑談",
    createdAt: 0,
    updatedAt: 0,
    nodes: [{ id: "r", position: { x: 0, y: 0 }, data: { label: "推し", memo: "", parentId: null, expanded: false, expanding: false, depth: 0, appearIndex: 0 } }],
    edges: [],
    pinnedNodeId: null,
    focusedNodeId: null,
  };

  it("作った人の鍵が無いと書き換えられない", async () => {
    const created = await saveShare({ id: null, key: null, board, nickname: "ぬ" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const renamed = { ...board, name: "差し替え" };
    expect(await saveShare({ id: created.id, key: null, board: renamed, nickname: "x" })).toEqual({ ok: false, reason: "forbidden" });
    expect(await saveShare({ id: created.id, key: "0".repeat(48), board: renamed, nickname: "x" })).toEqual({
      ok: false,
      reason: "forbidden",
    });
    const updated = await saveShare({ id: created.id, key: created.key, board: { ...board, name: "続き" }, nickname: "ぬ" });
    expect(updated.ok).toBe(true);
    const shared = await getShare(created.id);
    expect(shared?.board.name).toBe("続き");
    // 見る人には鍵のハッシュを返さない
    expect(shared && "owner" in shared).toBe(false);
  });

  it("新しく作るときだけ作成の回数を数え、使い切ったら作らない", async () => {
    let calls = 0;
    const allowCreate = () => {
      calls += 1;
      return calls <= 1;
    };
    const created = await saveShare({ id: null, key: null, board, nickname: "ぬ", allowCreate });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    // 持ち主の書き換えは作成に数えない
    expect((await saveShare({ id: created.id, key: created.key, board, nickname: "ぬ", allowCreate })).ok).toBe(true);
    expect(calls).toBe(1);
    expect(await saveShare({ id: null, key: null, board, nickname: "ぬ", allowCreate })).toEqual({ ok: false, reason: "limited" });
  });

  it("形の合わない ID・Object の組み込みの名前では読めない", async () => {
    expect(await getShare("__proto__")).toBeNull();
    expect(await getShare("constructor")).toBeNull();
    expect(await getShare("../x")).toBeNull();
  });
});
