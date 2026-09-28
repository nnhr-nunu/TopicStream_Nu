import { describe, expect, it } from "vitest";

import { addMixNode, canCombine } from "@/lib/board-combine";
import * as ops from "@/lib/board-ops";
import { combineInstruction, mixLabel, mixOriginNote, mockMixTopics, splitMix } from "@/lib/combine";
import { LABEL_MAX } from "@/lib/constants";
import { mockRelatedTopics } from "@/lib/mock-topics";
import { buildPrompt } from "@/lib/gemini-core";
import { normalizePrefs } from "@/lib/node-box";
import { emptyBoard } from "@/lib/storage";
import type { Board } from "@/lib/types";

const mandala = normalizePrefs({ generationLayout: "mandala", density: "comfortable" });
const radial = normalizePrefs({ generationLayout: "radial", density: "comfortable" });

/** 中心のお題を 8 つに広げたボード */
function expanded(prefs = mandala): Board {
  const root = ops.createRootBoard(emptyBoard(), "ゲーム", prefs);
  const begun = ops.beginExpand(root, root.nodes[0]!.id, 8, prefs)!;
  return ops.fillExpand(begun.board, root.nodes[0]!.id, begun.childIds, ["料理", "旅行", "音楽", "映画", "本", "運動", "猫", "夜更かし"], prefs);
}

function byLabel(board: Board, label: string) {
  return board.nodes.find((node) => node.data.label === label)!;
}

describe("掛け合わせの文", () => {
  it("「A × B」を作って取り出せる", () => {
    expect(mixLabel("ゲーム", "料理")).toBe("ゲーム × 料理");
    expect(splitMix("ゲーム × 料理")).toEqual(["ゲーム", "料理"]);
    expect(splitMix("3×3")).toBeNull();
    expect(splitMix("料理")).toBeNull();
  });

  it("AI への指示に両方の語が入る（掛け合わせでないお題には入らない）", () => {
    expect(combineInstruction("ゲーム × 料理")).toContain("「ゲーム」と「料理」の掛け合わせ");
    expect(combineInstruction("ゲーム")).toBe("");
    expect(buildPrompt("ゲーム × 料理", [], 8)).toContain("掛け合わせ");
    expect(buildPrompt("ゲーム × 料理", [], 8, [], "chat", true)).toContain("掛け合わせ");
  });

  it("キー無しでも両方の語を使った話題で埋まる", () => {
    const topics = mockRelatedTopics("ゲーム × 料理", [], 11);
    expect(topics).toHaveLength(11);
    expect(topics[0]).toContain("ゲーム");
    expect(topics[0]).toContain("料理");
    expect(new Set(topics).size).toBe(topics.length);
    for (const topic of topics) expect(topic.length).toBeLessThanOrEqual(LABEL_MAX);
    expect(mockMixTopics("ゲーム", [], 8)).toBeNull();
  });
});

describe("掛け合わせのカード", () => {
  it("マンダラート: 重ねた先の子として新しい 3×3 の中央に置き、両方から線を引く", () => {
    const board = expanded();
    const source = byLabel(board, "料理");
    const target = byLabel(board, "旅行");
    const added = addMixNode(board, source.id, target.id, mandala)!;
    const mix = added.board.nodes.find((node) => node.id === added.mixId)!;
    expect(mix.data.label).toBe("旅行 × 料理");
    expect(mix.data.parentId).toBe(target.id);
    expect(mix.data.mixedFromId).toBe(source.id);
    expect(mix.data.cellIndex).toBe(4);
    expect(mix.data.groupId).not.toBe(target.data.groupId);
    const edges = added.board.edges.filter((edge) => edge.target === mix.id).map((edge) => edge.source);
    expect(edges.sort()).toEqual([source.id, target.id].sort());
    // 重ねた先は「広げた」ことにならない（あとでふつうに広げられる）
    expect(byLabel(added.board, "旅行").data.expanded).toBe(false);

    // 周りの 8 枚は新しい 3×3 に入る
    const begun = ops.beginExpand(added.board, mix.id, 8, mandala)!;
    const kids = begun.board.nodes.filter((node) => begun.childIds.includes(node.id));
    expect(kids).toHaveLength(8);
    expect(kids.every((node) => node.data.groupId === mix.data.groupId)).toBe(true);
  });

  it("放射: 重ねた先の子として置く", () => {
    const board = expanded(radial);
    const added = addMixNode(board, byLabel(board, "猫").id, byLabel(board, "本").id, radial)!;
    const mix = added.board.nodes.find((node) => node.id === added.mixId)!;
    expect(mix.data.groupId).toBeUndefined();
    expect(mix.data.parentId).toBe(byLabel(board, "本").id);
  });

  it("同じカード・準備中のカード・作ったことのある組み合わせは掛け合わせない", () => {
    const board = expanded();
    const a = byLabel(board, "料理").id;
    const b = byLabel(board, "旅行").id;
    expect(canCombine(board, a, a).ok).toBe(false);
    const added = addMixNode(board, a, b, mandala)!;
    expect(canCombine(added.board, a, b).ok).toBe(false);
    expect(canCombine(added.board, b, a).ok).toBe(false);
    expect(addMixNode(added.board, b, a, mandala)).toBeNull();
  });

  it("1つ戻るで掛け合わせのカードごと消え、進むで戻る。重ねた先は広げられるまま", () => {
    const board = expanded();
    const source = byLabel(board, "料理");
    const target = byLabel(board, "旅行");
    const added = addMixNode(board, source.id, target.id, mandala)!;
    const begun = ops.beginExpand(added.board, added.mixId, 8, mandala)!;
    const history = ops.historyFromChildren(begun.board, target.id, [added.mixId], added.edgeIds);
    expect(history.nodes).toHaveLength(9);

    const undone = ops.undoExpand(begun.board, history);
    expect(undone.nodes).toHaveLength(board.nodes.length);
    expect(undone.edges).toHaveLength(board.edges.length);
    expect(byLabel(undone, "旅行").data.expanded).toBe(false);

    const redone = ops.redoExpand(undone, history);
    expect(redone.nodes).toHaveLength(begun.board.nodes.length);
    expect(byLabel(redone, "旅行").data.expanded).toBe(false);
  });

  it("重ねた先を作り直しても（具体的にする）、掛け合わせのカードは残る", () => {
    const board = expanded();
    const root = board.nodes.find((node) => node.data.parentId === null)!;
    const added = addMixNode(board, byLabel(board, "料理").id, root.id, mandala)!;
    const cleared = ops.clearChildren(added.board, root.id);
    expect(cleared.board.nodes.some((node) => node.id === added.mixId)).toBe(true);
    expect(cleared.board.nodes.some((node) => node.data.label === "旅行")).toBe(false);
  });
});

describe("掛け合わせの元の話", () => {
  it("2枚がそれぞれ何の話から出た語かを AI に伝える", () => {
    expect(mixOriginNote("キャンプ × 一番の失敗談", "アウトドア", "料理")).toBe(
      "「キャンプ」は「アウトドア」の話から、「一番の失敗談」は「料理」の話から出てきた語です。その意味で組み合わせてください。\n",
    );
    expect(mixOriginNote("キャンプ × 料理", undefined, undefined)).toBe("");
    expect(mixOriginNote("キャンプ", "a", "b")).toBe("");
    const prompt = buildPrompt("キャンプ × 一番の失敗談", [], 8, ["キャンプ", "アウトドア"], "chat", false, ["料理"]);
    expect(prompt).toContain("「一番の失敗談」は「料理」の話から");
    expect(prompt).toContain("片方だけで成り立つ語は出さない");
  });
});
