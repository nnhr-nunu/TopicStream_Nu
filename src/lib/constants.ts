export const STORAGE_KEY = "topicstream-nu:v1";
export const USAGE_KEY = "topicstream-nu:usage";
export const IDENTITY_KEY = "topicstream-nu:identity";
export const FAVORITES_KEY = "topicstream-nu:favorites";
export const CHILD_COUNT = 8;
export const MEMO_MAX = 120;
export const LABEL_MAX = 16;
export const ROOT_LABEL_MAX = 40;
export const DEFAULT_MODEL = "gemini-2.0-flash";

export const GEMINI_MODELS = [
  { value: "gemini-2.0-flash", label: "gemini-2.0-flash（推奨・速い）" },
  { value: "gemini-2.0-flash-lite", label: "gemini-2.0-flash-lite（より軽い）" },
  { value: "gemini-2.5-flash", label: "gemini-2.5-flash" },
  { value: "gemini-2.5-flash-lite", label: "gemini-2.5-flash-lite" },
] as const;

export const DEFAULT_SETTINGS = {
  geminiApiKey: "",
  geminiModel: DEFAULT_MODEL,
  fontScale: 1,
  density: "comfortable" as const,
  overlayTransparent: true,
  nickname: "",
  colorTheme: "fresh" as const,
};

export const RADIUS = {
  comfortable: 280,
  compact: 216,
  overlay: 320,
} as const;
