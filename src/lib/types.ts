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

export type GenerateSource = "gemini" | "mock";

export type GenerateResult = {
  topics: string[];
  source: GenerateSource;
  warning?: string;
};
