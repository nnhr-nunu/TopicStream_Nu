import { FAVORITES_KEY } from "@/lib/constants";

export function loadFavoriteBoardIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function saveFavoriteBoardIds(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
}

export function toggleFavoriteBoard(id: string): { ids: string[]; added: boolean } {
  const ids = loadFavoriteBoardIds();
  const has = ids.includes(id);
  const next = has ? ids.filter((item) => item !== id) : [...ids, id];
  saveFavoriteBoardIds(next);
  return { ids: next, added: !has };
}

const TOPIC_FAV_KEY = "topicstream-nu:topic-favs";
const topicFavListeners = new Set<() => void>();
let topicFavCache: string[] = [];
let topicFavRaw = "";

export function subscribeTopicFavorites(listener: () => void) {
  topicFavListeners.add(listener);
  return () => {
    topicFavListeners.delete(listener);
  };
}

export function loadFavoriteTopics(): string[] {
  if (typeof window === "undefined") return topicFavCache;
  try {
    const raw = window.localStorage.getItem(TOPIC_FAV_KEY) ?? "[]";
    if (raw === topicFavRaw) return topicFavCache;
    const parsed = JSON.parse(raw) as unknown;
    topicFavRaw = raw;
    topicFavCache = Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
    return topicFavCache;
  } catch {
    return topicFavCache;
  }
}

export function toggleFavoriteTopic(label: string): string[] {
  const current = loadFavoriteTopics();
  const next = current.includes(label)
    ? current.filter((item) => item !== label)
    : [...current, label];
  if (typeof window !== "undefined") {
    const raw = JSON.stringify(next);
    window.localStorage.setItem(TOPIC_FAV_KEY, raw);
    topicFavRaw = raw;
    topicFavCache = next;
    for (const listener of topicFavListeners) listener();
  }
  return next;
}
