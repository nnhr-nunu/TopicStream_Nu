import { totalHearts } from "@/lib/live-hearts";
import type { Board, TNode } from "@/lib/types";

/**
 * 話題ルーレット: まだ話していないカードから次の話題を選ぶ。
 * 広げていないカード（その先の話がまだ無いもの）を先に選び、無ければ広げたカードからも選ぶ。
 * 3×3 の中央の写し・最初のお題・いま話しているカード・空のカードは選ばない
 */
export function rouletteCandidates(board: Board): TNode[] {
  const usable = board.nodes.filter(
    (node) =>
      !node.data.placeholder &&
      !node.data.expanding &&
      !node.data.copiedFromId &&
      node.data.parentId !== null &&
      !node.data.talkedAt &&
      node.id !== board.pinnedNodeId &&
      Boolean(node.data.label.trim()),
  );
  const fresh = usable.filter((node) => !node.data.expanded);
  return fresh.length > 0 ? fresh : usable;
}

/** 「話した」の印が付いたカードがあるか（全部話し終えたとき、印を戻して回し直せるか） */
export function hasTalked(board: Board): boolean {
  return board.nodes.some((node) => Boolean(node.data.talkedAt));
}

/** 「話した」の印を全部外す（前の配信のボードを使い直すとき・ルーレットで全部話し終えたとき） */
export function clearTalked(board: Board): Board {
  if (!hasTalked(board)) return board;
  return {
    ...board,
    // 見る画面は updatedAt が変わったときだけ描き直すので、印を外したことも伝わるように進める
    updatedAt: Date.now(),
    nodes: board.nodes.map((node) => (node.data.talkedAt ? { ...node, data: { ...node.data, talkedAt: undefined } } : node)),
  };
}

/** 視聴者のハート（コメントの ❤・配信者の ♡）が多いカードほど当たりやすい（多くても 1 枚が独占しない程度に） */
export function rouletteWeight(node: TNode): number {
  return 1 + Math.min(20, totalHearts(node.data));
}

export function pickWeighted(nodes: TNode[], random: () => number = Math.random): TNode | undefined {
  const total = nodes.reduce((sum, node) => sum + rouletteWeight(node), 0);
  let ticket = random() * total;
  for (const node of nodes) {
    ticket -= rouletteWeight(node);
    if (ticket < 0) return node;
  }
  return nodes.at(-1);
}

export type SpinStep = { id: string; delay: number };

/**
 * 光らせる順と、次に進むまでの間（ミリ秒）。最後が当たり。はじめは速く、だんだんゆっくり止まる。
 * 動きを減らす設定の人には短く
 */
export function spinSequence(
  candidates: TNode[],
  winner: TNode,
  random: () => number = Math.random,
  reduced = false,
): SpinStep[] {
  const others = candidates.filter((node) => node.id !== winner.id);
  if (others.length === 0) return [{ id: winner.id, delay: 0 }];
  const count = reduced ? 3 : 16;
  const steps: SpinStep[] = [];
  let previous = "";
  for (let i = 0; i < count; i += 1) {
    const progress = i / (count - 1);
    // 当たりの 1 つ手前は、当たり以外にする（同じカードが 2 回続けて光ると止まったのが分かりにくい）
    const pool = i === count - 1 ? others : candidates;
    const choices = pool.filter((node) => node.id !== previous);
    const pick = (choices.length > 0 ? choices : pool)[Math.floor(random() * (choices.length > 0 ? choices.length : pool.length))]!;
    steps.push({ id: pick.id, delay: Math.round(55 + 380 * progress * progress) });
    previous = pick.id;
  }
  steps.push({ id: winner.id, delay: 0 });
  return steps;
}
