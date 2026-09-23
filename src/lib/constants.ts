export const STORAGE_KEY = "topicstream-nu:v1";
export const USAGE_KEY = "topicstream-nu:usage";
export const IDENTITY_KEY = "topicstream-nu:identity";
export const FAVORITES_KEY = "topicstream-nu:favorites";
export const CHILD_COUNT = 8;
export const MEMO_MAX = 120;
export const LABEL_MAX = 16;
export const ROOT_LABEL_MAX = 48;
export const LABEL_EDIT_MAX = 80;
export const DEFAULT_MODEL = "gemini-2.5-flash";
/** キーや時期で欠けるモデルがあるので、重複なしで順に試す。廃止の gemini-2.0-flash は含めない。 */
export const GEMINI_FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
] as const;
export const RETIRED_GEMINI_MODELS = ["gemini-2.0-flash"] as const;
export const GEMINI_HOST = "generativelanguage.googleapis.com";

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
  generationLayout: "mandala" as const,
  streamUrl: "",
  youtubeApiKey: "",
  showComments: false,
};

export const RADIUS = {
  comfortable: 168,
  compact: 140,
  overlay: 184,
} as const;
