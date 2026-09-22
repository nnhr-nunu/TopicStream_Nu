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

export const SEED_CATALOG: CatalogBoard[] = [
  pack(
    "cat_monday_chat",
    "月曜夜の雑談枠",
    "ぬぬ",
    ["雑談", "日常"],
    "週の始まりに使いやすい、買い物・ご飯・ヒヤリの定番セット。",
    186,
    "最近買ってよかったもの",
    ["失敗した買い物", "リピート確定", "推しグッズ", "100均の神", "配信機材", "高いけど満足", "食べ物のお取り寄せ", "生活が楽になった"],
  ),
  pack(
    "cat_game_swamp",
    "ゲーム沼トーク",
    "みお",
    ["ゲーム", "思い出"],
    "昔ハマった話から、今の課金・神曲・リメイク願望まで。",
    154,
    "昔ハマってたゲーム",
    ["課金しすぎた", "神曲BGM", "友達と徹夜", "今はもう無理", "リメイクしてほしい", "キャラ愛が深い", "初めてRTAした", "クリアできなかった"],
  ),
  pack(
    "cat_close_call",
    "ヒヤリ体験集",
    "そら",
    ["あるある", "深夜"],
    "今だから笑えるヒヤッとした話。リスナー投稿も拾いやすい。",
    141,
    "ヒヤッとした体験",
    ["電車でありがちな", "深夜の帰り道", "配信事故", "ギリギリセーフ", "今だから笑える", "パスワード忘れ", "二度としないこと", "リスナーのヒヤリ"],
  ),
  pack(
    "cat_oshi",
    "推し語りボード",
    "れん",
    ["推し", "布教"],
    "グッズ・ライブ余韻・沼の深さを一枚にまとめたコラボ向け。",
    128,
    "今週の推し活",
    ["ライブの余韻", "グッズ開封", "沼の深さ", "課金事情", "布教ポイント", "遠征あるある", "リスナーの推し", "推し変しそう"],
  ),
  pack(
    "cat_first_stream",
    "初配信あるある",
    "はる",
    ["配信", "初心者"],
    "初配信の震えと機材トラブル。今の自分を褒める回に。",
    97,
    "初配信の思い出",
    ["声が震えた", "人が来なくて", "タイトルミス", "機材トラブル", "最初のコメント", "続けられた理由", "今見ると恥ずかしい", "あの頃の自分へ"],
  ),
  pack(
    "cat_rainy_night",
    "雨の夜ごはん",
    "ゆい",
    ["ご飯", "季節"],
    "雨の日の過ごし方と、深夜に食べたくなるものの掛け合わせ。",
    88,
    "雨の日の過ごし方",
    ["鍋が食べたい", "雨音ASMR", "洗濯が乾かない", "好きな雨曲", "外出する派", "配信向きの天気", "窓際でダラダラ", "雨の匂い"],
  ),
];

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
