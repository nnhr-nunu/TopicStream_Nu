import { GEMINI_HOST } from "@/lib/constants";
import { GeminiRequestError, geminiDebug, isAbortError, networkError, parseGoogleError } from "@/lib/gemini-errors";
import { GEMINI_FIRST_CHUNK_MS, GEMINI_TIMEOUT_MS, geminiRetry, thinkingConfigFor } from "@/lib/gemini-models";
import { buildPrompt } from "@/lib/gemini-prompt";
import type { GeminiWaitStage } from "@/lib/topic-parse";
import type { BoardMode } from "@/lib/types";

/*
 * Gemini への 1 回のストリーミング生成（リクエストの組み立て・SSE の読み取り・時間切れの扱い）。
 * モデルを替えながら試す側は gemini-core.ts。
 */

/** 思考や JSON 指定を受け付けなかったモデル。以後はそれらを付けずに頼む。 */
const plainModels = new Set<string>();

export type GeminiOptions = {
  seed: string;
  existing: string[];
  apiKey: string;
  model: string;
  count: number;
  /** 最低これだけそろえばよい数（省くと count）。count との差は予備なので、足りなくても予備のためだけに呼び直さない */
  minimum?: number;
  /** 広げるカードの祖先（近い順）。汎用の切り口を広げるときに、何の話なのかを伝える */
  context?: string[];
  /** ボードの用途（雑談・お悩み相談など）。指示の中身が変わる */
  mode?: BoardMode;
  /** 「具体的にする」: 切り口ではなく、対応策・答え・話し方の例を短い文で出してもらう */
  detail?: boolean;
  /** 新しいキーワードが1つ読めるたびに呼ぶ（画面に1つずつ出すため）。モデルを替えても同じ語は2度呼ばない。 */
  onTopic?: (label: string) => void;
  /** 待ちが長引いたときに呼ぶ（switch: 別のモデルに聞き直す、retry: 2巡目に入る）。画面で待っている理由を見せる */
  onStage?: (stage: GeminiWaitStage) => void;
  /** Gemini へ1回リクエストを送るたびに呼ぶ（届いた usageMetadata の合計トークン。失敗・途中打ち切りは分かった分だけ） */
  onCall?: (tokens: number) => void;
  /** 掛け合わせのカードを広げるとき、持ってきた側のカードの祖先（近い順） */
  mixFrom?: string[];
  /** 全体の上限（省くと GEMINI_DEADLINE_MS）。まとめて何度も呼ぶ図鑑育てなどで短くする */
  deadlineMs?: number;
  /** 最初の文字を待つ時間（省くと GEMINI_FIRST_CHUNK_MS）。requestGemini が巡目ごとに決める */
  firstChunkMs?: number;
  /** 思考・JSON 指定を付けずに頼む（それらを受け付けなかったモデルへの頼み直し） */
  plain?: boolean;
  /** 利用者が自分で入れたキー。混雑の記録（モデルの後回し）は、みんなのキーの分と混ぜない */
  ownKey?: boolean;
};

export type Remaining = () => number;


function generationConfig(model: string, detail = false, plain = false): Record<string, unknown> {
  // Gemini 3 系は temperature を 1.0 未満にするとループや劣化が起きると公式に書かれているので、既定のまま送らない。
  // 答え（文）は長いので、途中で切れないよう多めに
  const base: Record<string, unknown> = { maxOutputTokens: detail ? 2048 : 1024 };
  if (plain || plainModels.has(model)) return base;
  const thinking = thinkingConfigFor(model);
  return {
    ...base,
    responseMimeType: "application/json",
    responseSchema: { type: "ARRAY", items: { type: "STRING" } },
    ...(thinking ? { thinkingConfig: thinking } : {}),
  };
}

type StreamChunk = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
  usageMetadata?: { thoughtsTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  error?: unknown;
};

/** 1回の生成の結果。partial は時間切れ・十分な数で打ち切ったときに true。 */
export type GeminiText = {
  text: string;
  partial: boolean;
  firstChunkMs?: number;
  totalMs: number;
  finishReason?: string;
  thoughtsTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

function chunkText(chunk: StreamChunk): string {
  return (
    chunk.candidates?.[0]?.content?.parts
      ?.filter((part) => !part.thought)
      .map((part) => part.text ?? "")
      .join("") ?? ""
  );
}

/**
 * ストリーミングで生成する。必要な数のキーワードがそろった時点で打ち切り、
 * 時間切れでも途中まで届いた分は返す（遅い日やループしたときでも空で終わらないように）。
 * 最初の文字が GEMINI_FIRST_CHUNK_MS 以内に来ないときは時間切れとして次のモデルへ回す。
 */
export async function generateGeminiText(
  options: GeminiOptions,
  remaining: Remaining,
  progress?: (text: string) => boolean,
): Promise<GeminiText> {
  const controller = new AbortController();
  const started = geminiRetry.now();
  let timedOut = false;
  let satisfied = false;
  const timer = setTimeout(
    () => {
      timedOut = true;
      controller.abort();
    },
    Math.max(1_000, Math.min(GEMINI_TIMEOUT_MS, remaining())),
  );
  const firstChunkTimer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.firstChunkMs ?? GEMINI_FIRST_CHUNK_MS);
  const endpoint = `https://${GEMINI_HOST}/v1beta/models/${encodeURIComponent(options.model)}:streamGenerateContent?alt=sse`;
  const result: GeminiText = { text: "", partial: false, totalMs: 0 };
  let retryPlain = false;
  let sent = false;

  const absorb = (chunk: StreamChunk) => {
    if (chunk.error) {
      throw new GeminiRequestError(
        "http",
        geminiDebug({ reason: "http-200-error", httpStatus: 200, model: options.model, ...parseGoogleError(chunk) }),
      );
    }
    if (result.firstChunkMs === undefined) {
      result.firstChunkMs = geminiRetry.now() - started;
      clearTimeout(firstChunkTimer);
    }
    result.text += chunkText(chunk);
    result.finishReason = chunk.candidates?.[0]?.finishReason ?? result.finishReason;
    result.thoughtsTokens = chunk.usageMetadata?.thoughtsTokenCount ?? result.thoughtsTokens;
    result.outputTokens = chunk.usageMetadata?.candidatesTokenCount ?? result.outputTokens;
    result.totalTokens = chunk.usageMetadata?.totalTokenCount ?? result.totalTokens;
  };

  try {
    sent = true;
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": options.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(options.seed, options.existing, options.count, options.context, options.mode, options.detail, options.mixFrom) }] }],
        generationConfig: generationConfig(options.model, options.detail, options.plain),
      }),
    });
    if (!response.ok) {
      clearTimeout(firstChunkTimer);
      const google = parseGoogleError(await response.json().catch(() => null));
      // 思考・JSON 指定を知らないモデルなら、付けずにもう一度頼む。
      // キーの間違いも同じ 400 で返るので、キーの話なら頼み直さない（全員の頼み方を変えてしまわないように）
      if (
        response.status === 400 &&
        google.googleStatus === "INVALID_ARGUMENT" &&
        !options.plain &&
        !plainModels.has(options.model) &&
        !/api[ _]?key/i.test(google.googleMessage ?? "")
      ) {
        retryPlain = true;
      } else {
        throw new GeminiRequestError(
          "http",
          geminiDebug({ reason: `http-${response.status}`, httpStatus: response.status, model: options.model, ...google }),
        );
      }
    } else if (response.body && typeof response.body.getReader === "function") {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";
        for (const event of events) {
          const data = event
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .join("");
          if (data) absorb(JSON.parse(data) as StreamChunk);
        }
        if (progress?.(result.text)) {
          satisfied = true;
          controller.abort();
          break;
        }
      }
    } else {
      // ストリームを返さない環境（テストのモックなど）は通常の JSON として読む
      const json = (await response.json()) as StreamChunk | StreamChunk[];
      for (const chunk of Array.isArray(json) ? json : [json]) absorb(chunk);
      progress?.(result.text);
    }
  } catch (error) {
    if (error instanceof GeminiRequestError) throw error;
    if (!(satisfied || (timedOut && result.text.trim()))) {
      if (isAbortError(error, controller.signal.aborted)) {
        throw new GeminiRequestError("timeout", geminiDebug({ reason: "timeout", model: options.model }));
      }
      throw networkError(options.model, error);
    }
  } finally {
    clearTimeout(timer);
    clearTimeout(firstChunkTimer);
    // 読み終わっていない返事（途中で例外になった等）の接続を残さない
    if (!controller.signal.aborted) controller.abort();
    if (sent) options.onCall?.(result.totalTokens ?? 0);
  }
  if (retryPlain) {
    const plain = await generateGeminiText({ ...options, plain: true }, remaining, progress);
    // 付けずに頼んで答えが返ったときだけ、以後もそのモデルは付けずに頼む
    plainModels.add(options.model);
    return plain;
  }
  result.partial = satisfied || timedOut;
  result.totalMs = geminiRetry.now() - started;
  return result;
}
