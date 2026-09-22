export const COLOR_THEMES = [
  { id: "fresh", label: "爽やか" },
  { id: "calm", label: "落ち着き" },
  { id: "stream", label: "配信ダーク" },
] as const;

export type ColorTheme = (typeof COLOR_THEMES)[number]["id"];

export function asColorTheme(value: unknown): ColorTheme {
  if (value === "calm" || value === "stream" || value === "fresh") return value;
  return "fresh";
}

export function isDarkTheme(theme: ColorTheme): boolean {
  return theme === "stream";
}
