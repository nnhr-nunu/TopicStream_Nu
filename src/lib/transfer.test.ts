import { describe, expect, it } from "vitest";

import { boardFromTopics } from "@/lib/catalog-data";
import {
  buildTransferPayload,
  formatTransferCode,
  mergeTransferredBoards,
  newTransferCode,
  normalizeTransferCode,
  openTransfer,
  sealTransfer,
  transferId,
  TRANSFER_ID_PATTERN,
} from "@/lib/transfer";
import type { Board } from "@/lib/types";

function board(root: string, updatedAt: number, memo = ""): Board {
  const built = boardFromTopics(root, ["昼まで寝る", "ひとりカフェ"]);
  return {
    ...built,
    updatedAt,
    nodes: built.nodes.map((node, index) => (index === 1 ? { ...node, data: { ...node.data, memo } } : node)),
  };
}

describe("引き継ぎコード", () => {
  it("読みまちがえにくい 8 文字で、毎回変わる", () => {
    const codes = new Set(Array.from({ length: 20 }, newTransferCode));
    expect(codes.size).toBe(20);
    for (const code of codes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it("小文字・ハイフン・空白・全角で入れても同じコードになる", () => {
    expect(normalizeTransferCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(normalizeTransferCode("ＡＢＣＤ ＥＦＧＨ")).toBe("ABCDEFGH");
    expect(formatTransferCode("ABCDEFGH")).toBe("ABCD-EFGH");
  });

  it("形が合わないコードは null", () => {
    expect(normalizeTransferCode("ABCD")).toBeNull();
    // 0 と 1 はコードに使わない
    expect(normalizeTransferCode("ABCD-EF01")).toBeNull();
    expect(normalizeTransferCode("")).toBeNull();
  });
});

describe("暗号化して預ける", () => {
  const payload = buildTransferPayload([board("休日の過ごし方", 10, "ここで新しいカフェの話")], ["ひとりカフェ"]);

  it("同じコードなら元に戻せる（付箋も運べる）", async () => {
    const sealed = await sealTransfer("ABCDEFGH", payload);
    const opened = await openTransfer("ABCDEFGH", sealed.data);
    expect(opened?.boards).toHaveLength(1);
    expect(opened?.boards[0]!.nodes.map((node) => node.data.label)).toEqual(
      payload.boards[0]!.nodes.map((node) => node.data.label),
    );
    expect(opened?.boards[0]!.nodes[1]!.data.memo).toBe("ここで新しいカフェの話");
    expect(opened?.topicFavs).toEqual(["ひとりカフェ"]);
  });

  it("サーバーに預ける文には、お題も付箋も読める形では入らない", async () => {
    const sealed = await sealTransfer("ABCDEFGH", payload);
    expect(sealed.id).toMatch(TRANSFER_ID_PATTERN);
    expect(sealed.id).toBe(await transferId("ABCDEFGH"));
    expect(sealed.data).not.toContain("休日");
    expect(sealed.data).not.toContain("カフェ");
    expect(sealed.id).not.toContain("abcdefgh");
  });

  it("コードが違う・壊れた文は開けない", async () => {
    const sealed = await sealTransfer("ABCDEFGH", payload);
    expect(await openTransfer("ABCDEFGJ", sealed.data)).toBeNull();
    expect(await openTransfer("ABCDEFGH", `${sealed.data.slice(0, -6)}AAAAAA`)).toBeNull();
    expect(await openTransfer("ABCDEFGH", "")).toBeNull();
    expect(await transferId("ABCDEFGJ")).not.toBe(sealed.id);
  });
});

describe("buildTransferPayload", () => {
  it("空のボードと、広げている途中の空のカードは運ばない", () => {
    const full = board("休日の過ごし方", 10);
    const waiting: Board = {
      ...full,
      id: "b2",
      nodes: full.nodes.map((node, index) => (index === 2 ? { ...node, data: { ...node.data, placeholder: true } } : node)),
    };
    const empty: Board = { ...full, id: "b3", nodes: [], edges: [] };
    const payload = buildTransferPayload([full, waiting, empty], []);
    expect(payload.boards.map((item) => item.id)).toEqual([full.id, "b2"]);
    expect(payload.boards[1]!.nodes).toHaveLength(full.nodes.length - 1);
  });
});

describe("mergeTransferredBoards", () => {
  const mine = board("休日の過ごし方", 100);

  it("手元に無いボードは足す", () => {
    const other = board("今ハマってるゲーム", 50);
    const merged = mergeTransferredBoards([mine], [other]);
    expect(merged.boards.map((item) => item.id)).toEqual([mine.id, other.id]);
    expect(merged).toMatchObject({ added: [other.id], updated: [], kept: [] });
  });

  it("同じボードは、あとで触った方を残す", () => {
    const newer = { ...mine, name: "受け取った方", updatedAt: 200 };
    expect(mergeTransferredBoards([mine], [newer])).toMatchObject({ boards: [newer], updated: [mine.id], kept: [] });
    const older = { ...mine, name: "受け取った方", updatedAt: 50 };
    expect(mergeTransferredBoards([mine], [older])).toMatchObject({ boards: [mine], updated: [], kept: [mine.id] });
  });
});
