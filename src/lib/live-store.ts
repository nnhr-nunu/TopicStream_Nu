import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SEED_CATALOG, SEED_TOPIC_SCORES, searchCatalog, type CatalogBoard, type PopularTopic } from "@/lib/catalog-data";
import { redisCommand, redisConfig } from "@/lib/redis";
import type { Board } from "@/lib/types";

type LiveState = {
  extraFavorites: Record<string, number>;
  topicScores: Record<string, number>;
  shares: Record<string, { board: Board; nickname: string; updatedAt: number }>;
};

const FILE = join(tmpdir(), "topicstream-nu-live.json");

let memory: LiveState = { extraFavorites: {}, topicScores: {}, shares: {} };
let loaded = false;

function load(): LiveState {
  if (loaded) return memory;
  loaded = true;
  try {
    memory = JSON.parse(readFileSync(FILE, "utf8")) as LiveState;
    memory.extraFavorites ??= {};
    memory.topicScores ??= {};
    memory.shares ??= {};
  } catch {
    memory = { extraFavorites: {}, topicScores: {}, shares: {} };
  }
  return memory;
}

function persist() {
  try {
    mkdirSync(tmpdir(), { recursive: true });
    writeFileSync(FILE, JSON.stringify(memory));
  } catch {
    /* Vercel などの読み取り専用環境ではメモリだけ使う */
  }
}

export function listCatalog(query = ""): CatalogBoard[] {
  const live = load();
  const boards = SEED_CATALOG.map((board) => ({
    ...board,
    favorites: board.favorites + (live.extraFavorites[board.id] ?? 0),
  })).sort((a, b) => b.favorites - a.favorites);
  return searchCatalog(boards, query);
}

export function bumpFavorite(id: string): number | null {
  const seed = SEED_CATALOG.find((board) => board.id === id);
  if (!seed) return null;
  const live = load();
  live.extraFavorites[id] = (live.extraFavorites[id] ?? 0) + 1;
  persist();
  return seed.favorites + live.extraFavorites[id];
}

export function bumpTopic(label: string, kind: string) {
  const weight = kind === "pins" ? 4 : kind === "copies" ? 2 : 3;
  const live = load();
  live.topicScores[label] = (live.topicScores[label] ?? 0) + weight;
  persist();
}

export function popularTopics(limit = 12): PopularTopic[] {
  const live = load();
  const map = new Map<string, number>();
  for (const item of SEED_TOPIC_SCORES) map.set(item.label, item.score);
  for (const [label, score] of Object.entries(live.topicScores)) {
    map.set(label, (map.get(label) ?? 0) + score);
  }
  return [...map.entries()]
    .map(([label, score]) => ({ label, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** 共有ボードは期限なしで残す。Redis があればサーバーを再起動しても消えない */
const shareKey = (id: string) => `ts:share:${id}`;

type Share = { board: Board; nickname: string; updatedAt: number };

export async function saveShare(id: string, board: Board, nickname: string) {
  const share: Share = { board, nickname, updatedAt: Date.now() };
  const live = load();
  live.shares[id] = share;
  persist();
  const config = redisConfig();
  if (!config) return;
  try {
    await redisCommand(config, ["SET", shareKey(id), JSON.stringify(share)]);
  } catch {
    /* Redis に書けなくてもメモリには残っている */
  }
}

export async function getShare(id: string): Promise<Share | null> {
  const local = load().shares[id];
  const config = redisConfig();
  if (!config) return local ?? null;
  try {
    const raw = await redisCommand(config, ["GET", shareKey(id)]);
    if (typeof raw === "string") return JSON.parse(raw) as Share;
  } catch {
    /* Redis が読めないときは手元の分で返す */
  }
  return local ?? null;
}
