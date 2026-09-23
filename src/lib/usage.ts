import { USAGE_KEY } from "@/lib/constants";

export type TopicUsage = {
  label: string;
  expands: number;
  pins: number;
  copies: number;
  lastUsed: number;
};

export type UsageMap = Record<string, TopicUsage>;

function readUsage(): UsageMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(USAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as UsageMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeUsage(map: UsageMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USAGE_KEY, JSON.stringify(map));
}

export function loadUsage(): UsageMap {
  return readUsage();
}

export function recordUsage(label: string, kind: "expands" | "pins" | "copies") {
  const trimmed = label.trim();
  if (!trimmed || trimmed === "…" || trimmed === "考え中") return;
  const map = readUsage();
  const current = map[trimmed] ?? {
    label: trimmed,
    expands: 0,
    pins: 0,
    copies: 0,
    lastUsed: 0,
  };
  current[kind] += 1;
  current.lastUsed = Date.now();
  map[trimmed] = current;
  writeUsage(map);

  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label: trimmed, kind }),
  }).catch(() => {
    /* demo catalog is best-effort */
  });
}

export function usageScore(stat: TopicUsage): number {
  return stat.expands * 3 + stat.pins * 4 + stat.copies * 2;
}

export function rankedLocalTopics(limit = 12): TopicUsage[] {
  return Object.values(readUsage())
    .sort((a, b) => usageScore(b) - usageScore(a) || b.lastUsed - a.lastUsed)
    .slice(0, limit);
}
