import * as ops from "@/lib/board-ops";
import { layoutBoard, prefsFromSettings } from "@/lib/layout";
import { emptyBoard } from "@/lib/storage";
import { rankedTopics, type KnowledgeEntry } from "@/lib/topic-knowledge";
import type { Board } from "@/lib/types";

/** 図鑑を見る画面で並べる語の数（マンダラートの 3×3 を埋める 8 枚） */
export const PREVIEW_TOPIC_COUNT = 8;

/**
 * 図鑑の1つのお題を、見るだけのボード（マンダラートの中央にお題・まわりに人気の語）にする。
 * みんなが作った話題マップの「見てみる」と同じ並べ方。始める前に「広げるとこんな感じ」を見せるためのもので、保存はしない。
 */
export function entryPreviewBoard(entry: KnowledgeEntry): Board | null {
  const labels = rankedTopics(entry, PREVIEW_TOPIC_COUNT);
  if (labels.length === 0) return null;
  const prefs = prefsFromSettings({ density: "comfortable", fontScale: 1, generationLayout: "mandala" }, false, null);
  const rooted = ops.createRootBoard(emptyBoard(entry.seed), entry.seed, prefs);
  const root = rooted.nodes[0];
  if (!root) return null;
  const begun = ops.beginExpand(rooted, root.id, labels.length, prefs);
  if (!begun) return null;
  const filled = ops.fillExpand(begun.board, root.id, begun.childIds, labels, prefs);
  // 語が 8 つに満たないときは空のマスを残さない
  const unused = new Set(begun.childIds.slice(labels.length));
  const trimmed = {
    ...filled,
    nodes: filled.nodes.filter((node) => !unused.has(node.id)),
    edges: filled.edges.filter((edge) => !unused.has(edge.target)),
  };
  return { ...layoutBoard(trimmed, prefs), pinnedNodeId: null, focusedNodeId: null };
}
