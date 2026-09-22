import { describe, expect, it } from "vitest";

import * as ops from "@/lib/board-ops";
import { layoutBoard, minNodeGap, placeChildren } from "@/lib/layout";
import { MANDALA_OFFSETS } from "@/lib/mandala";
import { GLYPH_PAD, hasGlyphOverlap, normalizePrefs } from "@/lib/node-box";
import { emptyBoard } from "@/lib/storage";
import type { Board } from "@/lib/types";

function positionsOf(board: Board) {
  return new Map(board.nodes.map((node) => [node.id, node.position]));
}

function inferPitch(board: Board) {
  const xs = board.nodes.map((node) => Math.abs(node.position.x)).filter((value) => value > 0.5);
  const ys = board.nodes.map((node) => Math.abs(node.position.y)).filter((value) => value > 0.5);
  return {
    pitchX: xs.length ? Math.min(...xs) : 1,
    pitchY: ys.length ? Math.min(...ys) : 1,
  };
}

function expandTree(
  layout: "radial" | "mandala",
  labels: string[] = ["春の話", "夏の予定", "秋の思い出", "冬の食べ物", "朝のルーチン", "昼のおやつ", "夜ふかし", "週末の予定"],
) {
  const prefs = normalizePrefs({ generationLayout: layout, density: "comfortable", fontScale: 1 });
  let board = ops.createRootBoard(emptyBoard("test"), "雑談のきっかけ", prefs);
  const rootId = board.nodes[0]!.id;
  const first = ops.beginExpand(board, rootId, 8, prefs);
  expect(first).not.toBeNull();
  board = ops.fillExpand(first!.board, rootId, first!.childIds, labels, prefs);
  return { board, rootId, childIds: first!.childIds, prefs };
}

describe("実サイズの重なり", () => {
  it("長い日本語・箋箋・NOWがあっても文字の箱が重ならない", () => {
    const prefs = normalizePrefs({ generationLayout: "radial", density: "comfortable", fontScale: 1.1 });
    let board = ops.createRootBoard(emptyBoard("test"), "今話したい長いキーワード", prefs);
    const rootId = board.nodes[0]!.id;
    const first = ops.beginExpand(board, rootId, 8, prefs)!;
    board = ops.fillExpand(
      first.board,
      rootId,
      first.childIds,
      ["方言あるあるを聞かせて", "地元のスーパーの思い出", "学校であった変なルール", "好きな曲の歌詞の話", "正義ってなんだろう", "もしも透明人間だったら", "深夜に食べたくなるもの", "リスナーに聞きたいこと"],
      prefs,
    );
    board = ops.setMemo(board, first.childIds[0]!, "ここでオチを置く。長い箋箋でも隣の文字に食い込まない。", prefs);
    board = ops.setMemo(board, first.childIds[3]!, "NOWの隣でも重ならない", prefs);
    board = ops.pinNode(board, first.childIds[3]!, prefs);
    const laid = layoutBoard(board, { ...prefs, pinnedNodeId: board.pinnedNodeId });
    expect(hasGlyphOverlap(laid.nodes, positionsOf(laid), { ...prefs, pinnedNodeId: laid.pinnedNodeId }, GLYPH_PAD - 1)).toBe(
      false,
    );
  });

  it("子から8個広げても、親の近くに収まり文字は重ならない", () => {
    const { board, rootId, childIds, prefs } = expandTree("radial");
    const childId = childIds[2]!;
    const nested = ops.beginExpand(board, childId, 8, prefs)!;
    const next = ops.fillExpand(
      nested.board,
      childId,
      nested.childIds,
      nested.childIds.map((_, index) => `孫の話題${index + 1}`),
      prefs,
    );
    expect(hasGlyphOverlap(next.nodes, positionsOf(next), prefs, GLYPH_PAD - 1)).toBe(false);
    const root = next.nodes.find((node) => node.id === rootId)!;
    const child = next.nodes.find((node) => node.id === childId)!;
    const grands = next.nodes.filter((node) => node.data.parentId === childId);
    const parentChild = Math.hypot(child.position.x - root.position.x, child.position.y - root.position.y);
    expect(parentChild).toBeLessThan(minNodeGap("comfortable") * 3.4);
    for (const grand of grands) {
      const dist = Math.hypot(grand.position.x - child.position.x, grand.position.y - child.position.y);
      expect(dist).toBeLessThan(minNodeGap("comfortable") * 4.2);
    }
  });
});

describe("マンダラート", () => {
  it("中央が親で、周囲8マスがマス目に乗る", () => {
    const { board, rootId, prefs } = expandTree("mandala");
    const { pitchX, pitchY } = inferPitch(board);
    const root = board.nodes.find((node) => node.id === rootId)!;
    expect(root.position.x).toBe(0);
    expect(root.position.y).toBe(0);
    const kids = board.nodes.filter((node) => node.data.parentId === rootId);
    expect(kids).toHaveLength(8);
    const expected = new Set(MANDALA_OFFSETS.map((offset) => `${offset.x * pitchX},${offset.y * pitchY}`));
    for (const kid of kids) {
      expect(expected.has(`${kid.position.x},${kid.position.y}`)).toBe(true);
    }
    expect(hasGlyphOverlap(board.nodes, positionsOf(board), { ...prefs, pinnedNodeId: board.pinnedNodeId }, GLYPH_PAD - 1)).toBe(false);
  });

  it("マスを開くと、次の3×3がマス目のままくっつく", () => {
    const { board, childIds, prefs } = expandTree("mandala");
    const east = board.nodes.find((node) => node.id === childIds[4])!;
    const nested = ops.beginExpand(board, east.id, 8, prefs)!;
    const next = ops.fillExpand(
      nested.board,
      east.id,
      nested.childIds,
      nested.childIds.map((_, index) => `次のマス${index + 1}`),
      prefs,
    );
    const { pitchX, pitchY } = inferPitch(next);
    const grands = next.nodes.filter((node) => node.data.parentId === east.id);
    expect(grands).toHaveLength(8);
    for (const node of next.nodes) {
      expect(Math.abs(node.position.x / pitchX - Math.round(node.position.x / pitchX))).toBeLessThan(0.001);
      expect(Math.abs(node.position.y / pitchY - Math.round(node.position.y / pitchY))).toBeLessThan(0.001);
    }
    const used = new Set(next.nodes.map((node) => `${node.position.x},${node.position.y}`));
    expect(used.size).toBe(next.nodes.length);
    expect(hasGlyphOverlap(next.nodes, positionsOf(next), prefs, GLYPH_PAD - 1)).toBe(false);
    const minDist = Math.min(
      ...grands.map((node) => Math.hypot(node.position.x - east.position.x, node.position.y - east.position.y)),
    );
    expect(minDist).toBeLessThanOrEqual(Math.hypot(pitchX * 2, pitchY * 2) + 1);
  });
});

describe("placeChildren の互換", () => {
  it("放射の8個は親のまわりに置かれる", () => {
    const points = placeChildren({
      parent: { x: 0, y: 0 },
      count: 8,
      existing: [{ x: 0, y: 0 }],
      density: "comfortable",
      parentDepth: 0,
    });
    expect(points).toHaveLength(8);
  });
});
