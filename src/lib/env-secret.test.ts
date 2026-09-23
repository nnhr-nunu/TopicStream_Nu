import { describe, expect, it } from "vitest";

import { sanitizeSecret } from "@/lib/env-secret";

describe("環境変数のキー", () => {
  it("前後の空白と引用符を外す", () => {
    expect(sanitizeSecret('  "AIzaSyExample"  ')).toBe("AIzaSyExample");
    expect(sanitizeSecret("'AIzaSyExample'")).toBe("AIzaSyExample");
    expect(sanitizeSecret("  AIzaSyExample  ")).toBe("AIzaSyExample");
    expect(sanitizeSecret("")).toBe("");
    expect(sanitizeSecret(undefined)).toBe("");
  });
});
