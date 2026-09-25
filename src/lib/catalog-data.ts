import { createId } from "@/lib/ids";
import { layoutBoard, placeChildren } from "@/lib/layout";
import type { Board, TEdge, TNode } from "@/lib/types";

export type CatalogBoard = {
  id: string;
  name: string;
  author: string;
  tags: string[];
  summary: string;
  favorites: number;
  keywords: string[];
  nodes: TNode[];
  edges: TEdge[];
};

export type PopularTopic = {
  label: string;
  score: number;
};

function node(id: string, label: string, x: number, y: number, parentId: string | null, depth: number, index: number, expanded = false): TNode {
  return {
    id,
    position: { x, y },
    data: {
      label,
      memo: "",
      parentId,
      expanded,
      expanding: false,
      depth,
      appearIndex: index,
    },
  };
}

function star(boardId: string, root: string, children: string[]): { nodes: TNode[]; edges: TEdge[] } {
  const rootId = `${boardId}_root`;
  const rootNode = node(rootId, root, 0, 0, null, 0, 0, children.length > 0);
  const positions = placeChildren({
    parent: { x: 0, y: 0 },
    count: children.length,
    existing: [{ x: 0, y: 0 }],
    density: "comfortable",
  });
  const childNodes = children.map((label, index) =>
    node(`${boardId}_c${index}`, label, positions[index]!.x, positions[index]!.y, rootId, 1, index),
  );
  const edges = childNodes.map((child, index) => ({
    id: `${boardId}_e${index}`,
    source: rootId,
    target: child.id,
  }));
  return { nodes: [rootNode, ...childNodes], edges };
}

function pack(
  id: string,
  name: string,
  author: string,
  tags: string[],
  summary: string,
  favorites: number,
  root: string,
  children: string[],
): CatalogBoard {
  const graph = star(id, root, children);
  return {
    id,
    name,
    author,
    tags,
    summary,
    favorites,
    keywords: [root, ...children],
    nodes: graph.nodes,
    edges: graph.edges,
  };
}

/** みんなが公開したテーマボード。公開前は空で、画面側で「これから増えていきます」と案内する。 */
export const SEED_CATALOG: CatalogBoard[] = [];

export const SEED_TOPIC_SCORES: PopularTopic[] = [
  { label: "最近買ってよかったもの", score: 220 },
  { label: "ヒヤッとした体験", score: 180 },
  { label: "昔ハマってたゲーム", score: 170 },
  { label: "地元のイントネーション、他県だと笑われる？", score: 164 },
  { label: "出身地あるある、急に思い出した", score: 158 },
  { label: "最近のマイブーム、まだ人に言ってないやつ", score: 152 },
  { label: "今週の推し活", score: 150 },
  { label: "もし配信してなかった自分、何してる？", score: 148 },
  { label: "学生のころの部活、今もネタになる？", score: 146 },
  { label: "何度もループしてる曲、ある？", score: 144 },
  { label: "これだけはゆずれない、ちょっとしたルール", score: 140 },
  { label: "初配信の思い出", score: 120 },
  { label: "雨の日の過ごし方", score: 110 },
  { label: "料理で失敗した話", score: 96 },
  { label: "今欲しいガジェット", score: 90 },
  { label: "深夜に無性に食べたくなるもの", score: 84 },
  { label: "リスナーに聞きたいこと", score: 78 },
];

export function catalogBoardToBoard(catalog: CatalogBoard, name?: string): Board {
  const now = Date.now();
  const pinned = catalog.nodes[0]?.id ?? null;
  const board: Board = {
    id: createId("board"),
    name: name ?? catalog.name,
    createdAt: now,
    updatedAt: now,
    nodes: catalog.nodes.map((item) => ({
      ...item,
      data: { ...item.data, expanding: false, placeholder: false },
    })),
    edges: catalog.edges.map((edge) => ({ ...edge })),
    pinnedNodeId: pinned,
    focusedNodeId: pinned,
  };
  return layoutBoard(board, "comfortable");
}

export function searchCatalog(boards: CatalogBoard[], query: string): CatalogBoard[] {
  const q = query.trim().toLowerCase();
  if (!q) return boards;
  return boards.filter((board) => {
    const hay = [board.name, board.author, board.summary, ...board.tags, ...board.keywords]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

/** お題とそこから出た語で、AI を呼ばずに1枚のボードを作る（トピック図鑑から始めるとき）。残りの語は中央の予備にする */
export function boardFromTopics(root: string, topics: string[], childCount = 8): Board {
  const id = createId("kb");
  const board = catalogBoardToBoard(pack(id, root.slice(0, 24), "", [], "", 0, root, topics.slice(0, childCount)), root.slice(0, 24));
  const spares = topics.slice(childCount, childCount + 12);
  if (spares.length === 0) return board;
  return {
    ...board,
    nodes: board.nodes.map((node) => (node.data.parentId === null ? { ...node, data: { ...node.data, spares } } : node)),
  };
}
