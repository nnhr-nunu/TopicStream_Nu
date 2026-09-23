export type GeminiDebug = {
  reason: string;
  kind: string;
  googleStatus?: string;
  googleMessage?: string;
  httpStatus?: number;
  host: string;
  model: string;
  tried?: string[];
};
