import type { CatalogBoard } from "@/lib/catalog-data";
import { LABEL_MAX, ROOT_LABEL_MAX } from "@/lib/constants";
import { looksPersonal } from "@/lib/personal-text";
import type { Board, TEdge, TNode } from "@/lib/types";

/**
 * みんなのトークテーマ（純粋な計算）。利用者がちゃんと使ったボードを、メモを外して一覧に載せる。
 * 保存はサーバー（community-server.ts）、送信はクライアント（community-client.ts）。
 */

/** 一覧に載せるボード。メモ・予備の候補は持たない */
export type CommunityBoard = {
  id: string;
  name: string;
  root: string;
  nodes: TNode[];
  edges: TEdge[];
  cards: number;
  opened: number;
  hearts: number;
  updatedAt: number;
};

export type BoardUsage = { cards: number; opened: number; hearts: number };

const NODE_LIMIT = 300;
/** 使われ具合の半減期。新しく使われたボードほど上に来る */
const HALF_LIFE_HOURS = 72;

function realNodes(board: Board): TNode[] {
  return board.nodes.filter((node) => !node.data.placeholder && node.data.label.trim());
}

export function boardUsage(board: Board): BoardUsage {
  const nodes = realNodes(board);
  return {
    cards: nodes.length,
    // 最初のお題を広げただけでなく、そこから出た話題も押したか
    opened: nodes.filter((node) => node.data.parentId !== null && node.data.expanded).length,
    hearts: nodes.reduce((sum, node) => sum + (node.data.heartCount ?? 0), 0),
  };
}

/** 最初の8枚から、もう一歩広げたボードだけ載せる */
export function isWellUsed(board: Board): boolean {
  const usage = boardUsage(board);
  return usage.cards >= 12 && usage.opened >= 1;
}

function isDefaultName(name: string): boolean {
  return /^\d{1,2}月\d{1,2}日の雑談$/.test(name) || /^新しいボード/.test(name);
}

/** 載せられる形にする（メモを外し、個人につながりそうな語があれば載せない） */
export function toCommunityBoard(board: Board, id: string, now = Date.now()): CommunityBoard | null {
  if (!isWellUsed(board)) return null;
  const nodes = realNodes(board).slice(0, NODE_LIMIT);
  const root = nodes.find((node) => node.data.parentId === null);
  if (!root) return null;
  if (nodes.some((node) => looksPersonal(node.data.label))) return null;
  const ids = new Set(nodes.map((node) => node.id));
  const rootLabel = root.data.label.trim().slice(0, ROOT_LABEL_MAX);
  const name = board.name.trim();
  return {
    id,
    name: !name || isDefaultName(name) || looksPersonal(name) ? rootLabel : name.slice(0, 40),
    root: rootLabel,
    nodes: nodes.map((node) => ({
      id: node.id,
      position: node.position,
      data: {
        ...node.data,
        label: node.data.label.trim().slice(0, node.data.parentId === null ? ROOT_LABEL_MAX : LABEL_MAX * 2),
        memo: "",
        expanding: false,
        spares: undefined,
        copiedFromId: undefined,
      },
    })),
    edges: board.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
    ...boardUsage(board),
    updatedAt: now,
  };
}

/** 使われている感（広げた数・カード・♡）に、新しさを掛ける */
export function communityScore(board: CommunityBoard, favorites: number, now = Date.now()): number {
  const usage = board.cards + board.opened * 6 + board.hearts * 2 + favorites * 8;
  const hours = Math.max(0, now - board.updatedAt) / 3_600_000;
  return usage * 0.5 ** (hours / HALF_LIFE_HOURS);
}

export function usedAgo(updatedAt: number, now = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - updatedAt) / 60_000);
  if (minutes < 60) return minutes < 5 ? "さっき使用" : `${minutes}分前に使用`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前に使用`;
  return `${Math.floor(hours / 24)}日前に使用`;
}

/** 使われている順に並べ、同じお題のボードはいちばん使われた1枚だけにする */
export function rankCommunityBoards(
  boards: CommunityBoard[],
  favorites: Record<string, number>,
  now = Date.now(),
): CatalogBoard[] {
  const scored = boards
    .map((board) => ({ board, favorites: favorites[board.id] ?? 0 }))
    .map((item) => ({ ...item, score: communityScore(item.board, item.favorites, now) }))
    .sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const result: CatalogBoard[] = [];
  for (const { board, favorites: count } of scored) {
    const key = board.root.normalize("NFKC").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const children = board.nodes.filter((node) => node.data.parentId !== null).map((node) => node.data.label);
    result.push({
      id: board.id,
      name: board.name,
      author: "",
      tags: [usedAgo(board.updatedAt, now)],
      summary: `「${board.root}」から ${board.opened}か所ひろげた、カード${board.cards}枚のマップ。`,
      favorites: count,
      keywords: [board.root, ...children],
      nodes: board.nodes,
      edges: board.edges,
    });
  }
  return result;
}
