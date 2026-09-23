export const STORAGE_KEY = "topicstream-nu:v1";
export const USAGE_KEY = "topicstream-nu:usage";
export const IDENTITY_KEY = "topicstream-nu:identity";
export const FAVORITES_KEY = "topicstream-nu:favorites";
export const CHILD_COUNT = 8;
export const MEMO_MAX = 120;
export const LABEL_MAX = 16;
export const ROOT_LABEL_MAX = 48;
export const LABEL_EDIT_MAX = 80;
export const DEFAULT_MODEL = "gemini-3.5-flash";
/** 指定モデルが 404 / 混雑のとき、この順で次を試す（キーは付けない）。 */
export const GEMINI_FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
] as const;
export const GEMINI_HOST = "generativelanguage.googleapis.com";
export const RETIRED_GEMINI_MODELS = new Set(["gemini-2.0-flash", "gemini-2.0-flash-lite"]);

export function resolveGeminiModel(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return DEFAULT_MODEL;
  const model = raw.trim();
  return RETIRED_GEMINI_MODELS.has(model) ? DEFAULT_MODEL : model;
}

export const GEMINI_MODELS = [
  { value: "gemini-3.5-flash", label: "gemini-3.5-flash（推奨・速い）" },
  { value: "gemini-3.5-flash-lite", label: "gemini-3.5-flash-lite（より軽い）" },
  { value: "gemini-3.8-flash", label: "gemini-3.8-flash" },
  { value: "gemini-2.5-flash", label: "gemini-2.5-flash" },
  { value: "gemini-flash-latest", label: "gemini-flash-latest" },
] as const;

export const DEFAULT_SETTINGS = {
  geminiApiKey: "",
  geminiModel: DEFAULT_MODEL,
  fontScale: 1,
  density: "comfortable" as const,
  overlayTransparent: true,
  nickname: "",
  colorTheme: "fresh" as const,
  generationLayout: "mandala" as const,
  streamUrl: "",
  youtubeApiKey: "",
};

export const RADIUS = {
  comfortable: 168,
  compact: 140,
  overlay: 184,
} as const;
