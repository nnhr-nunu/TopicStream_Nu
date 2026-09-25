import { describe, expect, it } from "vitest";

import { adScriptSrc, readAdConfig } from "./ads";

describe("readAdConfig", () => {
  it("未設定なら広告を出さない", () => {
    expect(readAdConfig({})).toEqual({ client: "", slot: "", sideSlot: "" });
  });

  it("正しい ID は前後の空白を落として使う", () => {
    expect(readAdConfig({ client: " ca-pub-1234567890123456 ", slot: " 1234567890 " })).toEqual({
      client: "ca-pub-1234567890123456",
      slot: "1234567890",
      sideSlot: "1234567890",
    });
  });

  it("サイド用スロットがあればそれを使い、無ければ通常のスロットを流用する", () => {
    const client = "ca-pub-1234567890123456";
    expect(readAdConfig({ client, slot: "1234567890", sideSlot: "9876543210" }).sideSlot).toBe("9876543210");
    expect(readAdConfig({ client, slot: "1234567890", sideSlot: "x" }).sideSlot).toBe("1234567890");
  });

  it("パブリッシャー ID が不正ならスロットも無効にする", () => {
    expect(readAdConfig({ client: "pub-1234567890123456", slot: "1234567890" })).toEqual({
      client: "",
      slot: "",
      sideSlot: "",
    });
  });

  it("スロット ID が不正なら枠だけ出さない", () => {
    expect(readAdConfig({ client: "ca-pub-1234567890123456", slot: "abc" })).toEqual({
      client: "ca-pub-1234567890123456",
      slot: "",
      sideSlot: "",
    });
  });
});

describe("adScriptSrc", () => {
  it("client をクエリに付ける", () => {
    expect(adScriptSrc("ca-pub-1")).toBe(
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1",
    );
  });
});
