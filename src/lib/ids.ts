export function createId(prefix = "n"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function todayBoardName(now = new Date()): string {
  return `${now.getMonth() + 1}月${now.getDate()}日の雑談`;
}

export function nextBoardName(existing: string[], now = new Date()): string {
  const today = todayBoardName(now);
  if (!existing.includes(today)) return today;
  if (!existing.includes("新しいボード")) return "新しいボード";
  let index = 2;
  while (existing.includes(`新しいボード ${index}`)) index += 1;
  return `新しいボード ${index}`;
}
