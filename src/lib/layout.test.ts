import { describe, expect, it } from "vitest";

import * as ops from "@/lib/board-ops";
import { layoutBoard, minNodeGap, placeChildren } from "@/lib/layout";
import { cellCode, CENTER_CELL_INDEX, familyIndexForGroup } from "@/lib/mandala-ids";
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
  return { board, rootId, childIds: first!.childIds, prefs, edgeIds: first!.edgeIds };
}

describe("実サイズの重なり", () => {
  it("長い日本語・付箋・NOWがあっても文字の箱が重ならない", () => {
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
    board = ops.setMemo(board, first.childIds[0]!, "ここでオチを置く。長い付箋でも隣の文字に食い込まない。", prefs);
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
  it("最初の展開は同じグループの9マスで、線はなく ID は 1A〜1I", () => {
    const { board, rootId, childIds, prefs } = expandTree("mandala");
    const { pitchX, pitchY } = inferPitch(board);
    const root = board.nodes.find((node) => node.id === rootId)!;
    expect(root.position.x).toBe(0);
    expect(root.position.y).toBe(0);
    expect(root.data.groupId).toBe(1);
    expect(root.data.cellIndex).toBe(CENTER_CELL_INDEX);
    expect(cellCode(root.data.groupId!, root.data.cellIndex!)).toBe("1E");
    expect(board.edges).toHaveLength(0);
    expect(board.nodes).toHaveLength(9);
    const kids = board.nodes.filter((node) => node.data.parentId === rootId);
    expect(kids).toHaveLength(8);
    expect(childIds).toHaveLength(8);
    const codes = board.nodes.map((node) => cellCode(node.data.groupId!, node.data.cellIndex!)).sort();
    expect(codes).toEqual(["1A", "1B", "1C", "1D", "1E", "1F", "1G", "1H", "1I"]);
    const expected = new Set(MANDALA_OFFSETS.map((offset) => `${offset.x * pitchX},${offset.y * pitchY}`));
    for (const kid of kids) {
      expect(kid.data.groupId).toBe(1);
      expect(kid.data.familyIndex).toBe(root.data.familyIndex);
      expect(kid.data.role).toBe("keyword");
      expect(expected.has(`${kid.position.x},${kid.position.y}`)).toBe(true);
    }
    expect(hasGlyphOverlap(board.nodes, positionsOf(board), { ...prefs, pinnedNodeId: board.pinnedNodeId }, GLYPH_PAD - 1)).toBe(
      false,
    );
  });

  it("マスを開くと中央は同じIDのまま色だけ変わり、線は中心同士", () => {
    const { board, childIds, prefs } = expandTree("mandala");
    const east = board.nodes.find((node) => node.id === childIds.find((id) => {
      const node = board.nodes.find((item) => item.id === id);
      return node?.data.cellIndex === 5;
    }))!;
    const seed = east.data.label;
    const homeCode = cellCode(east.data.groupId!, east.data.cellIndex!);
    const nested = ops.beginExpand(board, east.id, 8, prefs)!;
    const next = ops.fillExpand(
      nested.board,
      east.id,
      nested.childIds,
      nested.childIds.map((_, index) => `次のマス${index + 1}`),
      prefs,
    );
    expect(nested.edgeIds).toHaveLength(1);
    expect(next.edges).toHaveLength(1);
    expect(next.edges[0]!.target).toBe(east.id);
    const center = next.nodes.find((node) => node.id === east.id)!;
    expect(center.data.label).toBe(seed);
    expect(center.data.role).toBe("source");
    expect(center.data.hostsGroupId).toBe(2);
    expect(cellCode(center.data.groupId!, center.data.cellIndex!)).toBe(homeCode);
    expect(homeCode).toBe("1F");
    const keywords = next.nodes.filter((node) => node.data.groupId === 2 && node.data.role === "keyword");
    expect(keywords).toHaveLength(8);
    expect(new Set(keywords.map((node) => node.data.familyIndex)).size).toBe(1);
    expect(keywords[0]!.data.familyIndex).toBe(center.data.familyIndex);
    expect(center.data.familyIndex).not.toBe(familyIndexForGroup(1));
    const keywordCodes = keywords.map((node) => cellCode(node.data.groupId!, node.data.cellIndex!)).sort();
    expect(keywordCodes).toEqual(["2A", "2B", "2C", "2D", "2F", "2G", "2H", "2I"]);
    for (const node of next.nodes) {
      const { pitchX, pitchY } = inferPitch(next);
      expect(Math.abs(node.position.x / pitchX - Math.round(node.position.x / pitchX))).toBeLessThan(0.001);
      expect(Math.abs(node.position.y / pitchY - Math.round(node.position.y / pitchY))).toBeLessThan(0.001);
    }
    const used = new Set(next.nodes.map((node) => `${node.position.x},${node.position.y}`));
    expect(used.size).toBe(next.nodes.length);
    expect(hasGlyphOverlap(next.nodes, positionsOf(next), prefs, GLYPH_PAD - 1)).toBe(false);
  });

  it("付箋は3×3のマス間隔を変えない", () => {
    const { board, childIds, prefs } = expandTree("mandala");
    const before = inferPitch(board);
    const withMemo = ops.setMemo(board, childIds[0]!, "とても長い付箋でもマスの幅は変えない。隣のカードも押し出さない。", prefs);
    const after = inferPitch(withMemo);
    expect(after.pitchX).toBe(before.pitchX);
    expect(after.pitchY).toBe(before.pitchY);
    expect(withMemo.nodes.map((node) => `${node.position.x},${node.position.y}`)).toEqual(
      board.nodes.map((node) => `${node.position.x},${node.position.y}`),
    );
  });

  it("戻すとグループ番号を再利用できる", () => {
    const { board, childIds, prefs } = expandTree("mandala");
    const target = board.nodes.find((node) => node.id === childIds[0]!)!;
    const nested = ops.beginExpand(board, target.id, 8, prefs)!;
    const filled = ops.fillExpand(nested.board, target.id, nested.childIds, ["A", "B", "C", "D", "E", "F", "G", "H"], prefs);
    expect(filled.nodes.some((node) => node.data.groupId === 2)).toBe(true);
    const history = ops.historyFromChildren(filled, target.id, nested.childIds, nested.edgeIds);
    const undone = ops.undoExpand(filled, history);
    expect(undone.nodes.some((node) => node.data.groupId === 2)).toBe(false);
    const again = ops.beginExpand(undone, target.id, 8, prefs)!;
    expect(again.board.nodes.some((node) => node.data.groupId === 2 || node.data.hostsGroupId === 2)).toBe(true);
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
      generationLayout: "radial",
    });
    expect(points).toHaveLength(8);
  });
});
