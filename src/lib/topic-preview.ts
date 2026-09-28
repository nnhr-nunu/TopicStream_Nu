import * as ops from "@/lib/board-ops";
import { layoutBoard, prefsFromSettings } from "@/lib/layout";
import { emptyBoard } from "@/lib/storage";
import { rankedTopics, type KnowledgeEntry } from "@/lib/topic-knowledge";
import type { Board } from "@/lib/types";

/** 図鑑を見る画面で並べる語の数（ボードで1回広げたときと同じ 8 枚） */
export const PREVIEW_TOPIC_COUNT = 8;

/**
 * 図鑑の1つのお題を、見るだけのボード（中心にお題・まわりに人気の語）にする。
 * 取り込む前に「広げるとこんな感じ」を見せるためのもので、保存はしない。
 */
export function entryPreviewBoard(entry: KnowledgeEntry): Board | null {
  const labels = rankedTopics(entry, PREVIEW_TOPIC_COUNT);
  if (labels.length === 0) return null;
  const prefs = prefsFromSettings({ density: "comfortable", fontScale: 1, generationLayout: "radial" }, false, null);
  const rooted = ops.createRootBoard(emptyBoard(entry.seed), entry.seed, prefs);
  const root = rooted.nodes[0];
  if (!root) return null;
  const begun = ops.beginExpand(rooted, root.id, labels.length, prefs);
  if (!begun) return null;
  const filled = ops.fillExpand(begun.board, root.id, begun.childIds, labels, prefs);
  return { ...layoutBoard(filled, prefs), pinnedNodeId: null, focusedNodeId: null };
}
