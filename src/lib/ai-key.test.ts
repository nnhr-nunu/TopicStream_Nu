import { describe, expect, it } from "vitest";

import { describeKeyCheck } from "@/lib/ai-key";

describe("describeKeyCheck", () => {
  it("自分のキーで返事が来たら、つながったと伝える", () => {
    const result = describeKeyCheck(200, { ok: true, source: "browser", generation: { ok: true, totalMs: 820 } });
    expect(result.ok).toBe(true);
    expect(result.message).toContain("自分のキーで");
    expect(result.message).toContain("0.8 秒");
  });

  it("キーを入れずに試したら、みんなのキーの様子を伝える", () => {
    const result = describeKeyCheck(200, { ok: true, source: "server", generation: { ok: true } });
    expect(result.ok).toBe(true);
    expect(result.message).toContain("みんなで使っているキー");
  });

  it("Google に断られたキーは、貼り直しを促す", () => {
    const result = describeKeyCheck(200, { ok: false, source: "browser", httpStatus: 400, googleMessage: "API key not valid" });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("コピーし直して");
    // Google の生の返事は見せない
    expect(result.message).not.toContain("API key not valid");
  });

  it("キーは正しいが枠が無いときは、そう伝える", () => {
    const result = describeKeyCheck(200, {
      ok: true,
      source: "browser",
      generation: { ok: false, reason: "http-429", googleMessage: "Quota exceeded" },
    });
    expect(result).toMatchObject({ ok: false });
    expect(result.message).toContain("利用上限");
  });

  it("サーバーの無い公開版・連打・キー無しを分ける", () => {
    expect(describeKeyCheck(404, null).message).toContain("デモ");
    expect(describeKeyCheck(429, null).message).toContain("1 分");
    expect(describeKeyCheck(200, { ok: false, source: "none" }).message).toContain("キーが入っていません");
    expect(describeKeyCheck(0, null).ok).toBe(false);
  });
});
