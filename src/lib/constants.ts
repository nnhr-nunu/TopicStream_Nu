export const STORAGE_KEY = "topicstream-nu:v1";
export const USAGE_KEY = "topicstream-nu:usage";
export const IDENTITY_KEY = "topicstream-nu:identity";
export const FAVORITES_KEY = "topicstream-nu:favorites";
export const CHILD_COUNT = 8;
export const MEMO_MAX = 120;
export const LABEL_MAX = 16;
export const ROOT_LABEL_MAX = 48;
export const LABEL_EDIT_MAX = 80;
/**
 * 2026-09 時点の Gemini API。2.0 系は提供終了、2.5 系は「過去に使っていたプロジェクトだけ」に制限され、
 * 新しいキーでは 404 / 429 になる。短いキーワードを返すだけなので、速い 3.5 Flash-Lite を既定にする。
 */
export const DEFAULT_MODEL = "gemini-3.5-flash-lite";
/** 使えない・混んでいるときに順に試す（重複なし）。 */
export const GEMINI_FALLBACK_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
] as const;
/** 保存済み設定にあっても既定へ読み替える（提供終了・新規キーでは使えない）。 */
export const RETIRED_GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
] as const;
export const GEMINI_HOST = "generativelanguage.googleapis.com";

export const GEMINI_MODELS = [
  { value: "gemini-3.5-flash-lite", label: "3.5 Flash-Lite（推奨・速い）" },
  { value: "gemini-3.5-flash", label: "3.5 Flash" },
  { value: "gemini-3.6-flash", label: "3.6 Flash" },
  { value: "gemini-3.8-flash", label: "3.8 Flash（高性能・少し遅い）" },
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
