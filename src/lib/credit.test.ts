import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CREDIT_TEXT } from "./credit";

describe("クレジット表記", () => {
  it("README の「クレジット表記のお願い」と同じ文になっている", () => {
    const readme = readFileSync(join(process.cwd(), "README.md"), "utf-8").replace(/\r\n/g, "\n");
    expect(readme).toContain(`\`\`\`text\n${CREDIT_TEXT}\n\`\`\``);
  });

  it("ソフト名・開発者・各リンクが入っている", () => {
    for (const part of ["TopicStream(ぬ)", "ぬぬはら", "https://www.youtube.com/@nnhr_nunu", "https://x.com/nnhr_nunu", "https://topic-stream.oshilog.life/"]) {
      expect(CREDIT_TEXT).toContain(part);
    }
  });
});
