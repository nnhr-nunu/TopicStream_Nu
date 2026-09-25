import type { ColorTheme } from "@/lib/color-theme";

export type Density = "comfortable" | "compact";
export type GenerationLayout = "radial" | "mandala";

export type LayoutPrefs = {
  density?: Density;
  overlay?: boolean;
  fontScale?: number;
  generationLayout?: GenerationLayout;
  pinnedNodeId?: string | null;
};

export type TopicNodeRole = "source" | "keyword";

export type TopicNodeData = {
  label: string;
  memo: string;
  parentId: string | null;
  expanded: boolean;
  expanding: boolean;
  placeholder?: boolean;
  depth: number;
  appearIndex: number;
  sproutX?: number;
  sproutY?: number;
  groupId?: number;
  cellIndex?: number;
  familyIndex?: number;
  role?: TopicNodeRole;
  copiedFromId?: string;
  hostsGroupId?: number;
  heartCount?: number;
  frameHearts?: number;
  /** この下に広げたときに AI から余分にもらった候補。「作り直す」で API を呼ばずに使う */
  spares?: string[];
};

export type TNode = {
  id: string;
  position: { x: number; y: number };
  data: TopicNodeData;
};

export type TEdge = {
  id: string;
  source: string;
  target: string;
};

export type Board = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodes: TNode[];
  edges: TEdge[];
  pinnedNodeId: string | null;
  focusedNodeId: string | null;
};

export type Settings = {
  geminiApiKey: string;
  geminiModel: string;
  fontScale: number;
  density: Density;
  overlayTransparent: boolean;
  nickname: string;
  colorTheme: ColorTheme;
  generationLayout: GenerationLayout;
  streamUrl: string;
  youtubeApiKey: string;
  showComments: boolean;
  /** コメント欄の文字の倍率（配信画面に映す人向け） */
  commentScale: number;
};

export type AppSnapshot = {
  version: 1 | 2;
  boards: Board[];
  activeBoardId: string;
  settings: Settings;
};

export type HistoryEntry = {
  parentId: string;
  childIds: string[];
  edgeIds: string[];
  nodes: TNode[];
  edges: TEdge[];
};

export type UndoAction = HistoryEntry;

/** knowledge = トピック図鑑（過去に AI が出した語）から出した */
export type GenerateSource = "gemini" | "mock" | "knowledge";

export type GeminiDebug = {
  reason: string;
  googleStatus?: string;
  googleMessage?: string;
  httpStatus?: number;
  host: string;
  model: string;
  tried?: string[];
  /** 試したモデルごとの結果（例: "gemini-3.5-flash: timeout"）。キーは含めない。 */
  attempts?: string[];
};

export type GenerateResult = {
  topics: string[];
  source: GenerateSource;
  warning?: string;
  /** 同じ種類のお知らせを何度も出さないための分類（quota / busy / slow / unavailable） */
  noticeKind?: string;
  debug?: GeminiDebug;
};
