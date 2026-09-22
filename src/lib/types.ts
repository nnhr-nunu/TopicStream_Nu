export type Density = "comfortable" | "compact";

export type TopicNodeData = {
  label: string;
  memo: string;
  parentId: string | null;
  expanded: boolean;
  expanding: boolean;
  placeholder?: boolean;
  depth: number;
  appearIndex: number;
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
};

export type AppSnapshot = {
  version: 1;
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
