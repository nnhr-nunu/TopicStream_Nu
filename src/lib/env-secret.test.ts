import { describe, expect, it } from "vitest";

import { redactSecret, sanitizeApiKey, sanitizeSecret } from "@/lib/env-secret";

describe("環境変数のキー", () => {
  it("前後の空白と引用符を外す", () => {
    expect(sanitizeSecret('  "AIzaSyExample"  ')).toBe("AIzaSyExample");
    expect(sanitizeSecret("'AIzaSyExample'")).toBe("AIzaSyExample");
    expect(sanitizeSecret("  AIzaSyExample  ")).toBe("AIzaSyExample");
    expect(sanitizeSecret("")).toBe("");
    expect(sanitizeSecret(undefined)).toBe("");
    expect(redactSecret("Bearer AIzaSyExampleToken")).toContain("[redacted]");
  });
});

describe("sanitizeApiKey", () => {
  it("コピーで混ざった改行・ゼロ幅の文字・引用符を外す", () => {
    expect(sanitizeApiKey(' "AIzaSy​ABC-def_123\n" ')).toBe("AIzaSyABC-def_123");
  });
});
