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

/** ボードの用途。未設定は雑談 */
export type BoardMode = "chat" | "advice" | "idea" | "goal" | "review" | "learn";

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
  /** 「具体的にする」で出した答え（対応策・具体的な話題などの短い文）。作り直しも「具体的にする」の指示で行う */
  detail?: boolean;
  /** 掛け合わせで作ったカード: 重ねて持ってきた側のカード（親 parentId は重ねた先） */
  mixedFromId?: string;
  /** 話し終えた時刻（NOW を別のカードへ移した・外したとき）。ルーレットはこのカードを選ばない */
  talkedAt?: number;
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
  /** NOW にした時刻（上の帯に「話している時間」を出す） */
  pinnedAt?: number;
  /** 用途（未設定は雑談）。生成の指示・オフライン候補・図鑑に送るかが変わる */
  mode?: BoardMode;
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
  /** カードをタップしたときの動き（抽象展開＝切り口を広げる / 具体的＝「具体的にする」） */
  expandMode: ExpandMode;
  /** AI を待つ間に出る動物のうち、出さないもの（wait-critters.ts の CRITTER_KINDS） */
  hiddenCritters: string[];
  /** 待ち時間の動物の絵のタッチ（mix はおまかせ、cute はカードの上や間、real はカードの中） */
  critterStyle: "mix" | "cute" | "real";
};

export type ExpandMode = "abstract" | "detail";

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
  /** 作り直し（「具体的にする」で周りの 8 枚を差し替えた等）: 戻すときに、差し替える前の子をこれで戻す */
  replaced?: HistoryEntry;
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
  /** topics の先頭から何語が AI の語か（サーバーの答え。残りは埋め合わせ） */
  aiCount?: number;
  warning?: string;
  /** 同じ種類のお知らせを何度も出さないための分類（quota / busy / slow / unavailable） */
  noticeKind?: string;
  debug?: GeminiDebug;
  /** このお願いで Gemini を実際に呼んだ回数とトークン数（設定画面の利用状況に足す） */
  usage?: GeminiUsage;
  /**
   * AI が答えず、図鑑にも足りるだけの語が無かった。topics は定型の埋め合わせなので画面には出さず、
   * warning（時間を置いて再試行してほしい旨）だけを見せる
   */
  retryLater?: boolean;
};

export type GeminiUsage = { calls: number; tokens: number };
