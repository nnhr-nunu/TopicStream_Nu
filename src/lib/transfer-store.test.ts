import { describe, expect, it } from "vitest";

import { readTransfer, saveTransfer, TRANSFER_TTL_SECONDS } from "@/lib/transfer-store";
import { TRANSFER_MAX_CHARS } from "@/lib/transfer";

const ID = "0123456789abcdef0123456789abcdef";

describe("引き継ぎの預かり所（Redis が無いときはメモリ）", () => {
  it("預けた文を、時間内なら何度でも受け取れる", async () => {
    const saved = await saveTransfer(ID, "gAAAA", 1_000);
    expect(saved).toEqual({ ok: true, expiresAt: 1_000 + TRANSFER_TTL_SECONDS * 1000 });
    expect(await readTransfer(ID, 2_000)).toBe("gAAAA");
    expect(await readTransfer(ID, 3_000)).toBe("gAAAA");
  });

  it("15 分を過ぎたら消える", async () => {
    await saveTransfer(ID, "gAAAA", 1_000);
    expect(await readTransfer(ID, 1_000 + TRANSFER_TTL_SECONDS * 1000)).toBeNull();
  });

  it("番号の形が違う・大きすぎる・空の文は預からない", async () => {
    expect(await saveTransfer("../etc", "gAAAA")).toEqual({ ok: false, reason: "invalid" });
    expect(await saveTransfer(ID, "")).toEqual({ ok: false, reason: "invalid" });
    expect(await saveTransfer(ID, "a".repeat(TRANSFER_MAX_CHARS + 1))).toEqual({ ok: false, reason: "invalid" });
    expect(await readTransfer("nope")).toBeNull();
  });
});
