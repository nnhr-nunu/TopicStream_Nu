import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SEED_CATALOG, SEED_TOPIC_SCORES, searchCatalog, type CatalogBoard, type PopularTopic } from "@/lib/catalog-data";
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

export function saveShare(id: string, board: Board, nickname: string) {
  const live = load();
  live.shares[id] = { board, nickname, updatedAt: Date.now() };
  persist();
}

export function getShare(id: string) {
  return load().shares[id] ?? null;
}
