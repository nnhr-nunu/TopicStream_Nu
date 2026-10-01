import { apiPath, isNoServerResponse } from "@/lib/api-base";
import { CHILD_COUNT, DEFAULT_MODEL } from "@/lib/constants";
import { sanitizeSecret } from "@/lib/env-secret";
import { detailRecordSeed, mockDetailTopics } from "@/lib/detail-modes";
import { isJunkTopic, padTopics, type GeminiWaitStage } from "@/lib/topic-parse";
import { recordAiUsage } from "@/lib/ai-usage";
import { splitMix } from "@/lib/combine";
import { fetchSharedRelated, markFillers, recallTopicsNow, rememberTopics } from "@/lib/knowledge-client";
import { isRecordableSeed } from "@/lib/label-quality";
import { isGenericAngle, mockRelatedTopics, topicAnchor } from "@/lib/mock-topics";
import { parseMode } from "@/lib/modes";
import type { BoardMode, GenerateResult } from "@/lib/types";

/** 図鑑にこれだけ語がたまっているお題は、AI を呼ばずに図鑑から出す（たまに AI にも頼んで図鑑を育てる） */
const RECALL_AI_RATE = 0.25;
/** 図鑑の問い合わせを待つ上限（広げる速さを落とさないよう短め） */
const RECALL_WAIT_MS = 450;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type StreamLine =
  | { type: "topic"; label?: unknown }
  | { type: "stage"; stage?: unknown }
  | ({ type: "done" } & Partial<GenerateResult>);

/**
 * サーバー経由で関連キーワードを作る。サーバーは1語ずつ流してくるので、届くたびに onTopic を呼ぶ
 * （画面では空のカードへ順に入れて、体感の待ち時間を減らす）。
 * 失敗やサーバーの無い公開版では、オフライン候補（トピック図鑑 → 定型の組み合わせの順）をまとめて返す。
 * recall を付けると、図鑑に十分たまっているお題は AI を呼ばずに図鑑から出す。
 * context（広げるカードの祖先、近い順）を渡すと、AI にもオフライン候補にも「何の話の中のお題か」が伝わる。
 * 図鑑はモードごとに分けて読み書きする（お悩み相談の語が雑談の候補に混ざらない）。
 * detail（「具体的にする」）は対応策・答えの短い文を出す。図鑑からは引かず毎回作り、結果は図鑑に記録する。
 */
export async function generateRelatedTopics(options: {
  seed: string;
  existing: string[];
  apiKey?: string;
  model?: string;
  count?: number;
  /** 最低これだけそろえばよい数（count との差は「作り直す」用の予備。足りなくても予備のためだけに AI を呼び直さない） */
  minimum?: number;
  preferred?: string[];
  context?: string[];
  /** 掛け合わせのカードを広げるとき、持ってきた側のカードの祖先（近い順） */
  mixFrom?: string[];
  mode?: BoardMode;
  onTopic?: (label: string) => void;
  /** AI の待ちが長引いた理由（別のモデルに聞き直す・2巡目）。待っている間のお知らせに使う */
  onStage?: (stage: GeminiWaitStage) => void;
  recall?: boolean;
  detail?: boolean;
}): Promise<GenerateResult> {
  const count = options.count ?? CHILD_COUNT;
  const context = options.context ?? [];
  const mode = parseMode(options.mode);
  if (options.detail) {
    const mock = mockDetailTopics(options.seed, options.existing, count, mode, context);
    return requestTopics(options, { count, context, mode, mock, known: 0, recordSeed: detailRecordSeed(options.seed, context), detail: true });
  }
  // 「一番の失敗談」のような汎用の切り口は、図鑑にもこのお題としてはためない（別のお題の話が混ざる）
  const generic = isGenericAngle(options.seed, mode);
  // 図鑑はモードごとに分かれている（お悩み相談の語が雑談の候補に混ざらない）
  const anchor = mode === "chat" ? topicAnchor(context) : undefined;
  // みんなの図鑑は待ちすぎない。間に合わなければ手元の分で進め、届いた分は次から使う
  await Promise.race([
    Promise.all([fetchSharedRelated(options.seed, mode), anchor ? fetchSharedRelated(anchor, mode) : null]),
    wait(RECALL_WAIT_MS),
  ]);
  // 掛け合わせ（「A × B」）は似たお題の語を借りると片方だけの話になるので、図鑑からは出さない
  const mixed = Boolean(splitMix(options.seed));
  const recalled =
    generic || mixed ? { topics: [], depth: 0 } : recallTopicsNow(options.seed, options.existing, count, mode);
  // このお題で図鑑が足りないときは、元のお題の語で埋める（何も無くて汎用の切り口だけになるのを避ける）
  const related =
    anchor && !mixed && recalled.topics.length < count
      ? recallTopicsNow(anchor, [...options.existing, ...context], count, mode).topics
      : [];
  // お悩み相談などで深く広げたカードは、図鑑（ほかのボードで同じ語から出た語）だけで済ませない。
  // 中心のお題を知らない語が並び、話がズレていくため（AI には中心のお題を渡して寄せてもらう）
  const deep = mode !== "chat" && context.length >= 2;
  if (options.recall && !deep && recalled.depth >= count && recalled.topics.length >= count && Math.random() >= RECALL_AI_RATE) {
    for (const label of recalled.topics) {
      options.onTopic?.(label);
      await wait(40);
    }
    // 似たお題から借りた語が混ざるので、図鑑にこのお題の語として無いものは、選ばれても記録しない（markFillers）
    markFillers(options.seed, recalled.topics, mode);
    return { topics: recalled.topics, source: "knowledge" };
  }
  const mock = padTopics(
    recalled.topics,
    mockRelatedTopics(options.seed, options.existing, count, options.preferred ?? [], { context, related, mode }),
    count,
    options.seed,
  );
  return requestTopics(options, {
    count,
    context,
    mode,
    mock,
    known: recalled.topics.length,
    recordSeed: generic || !isRecordableSeed(options.seed, context) ? undefined : options.seed,
    detail: false,
  });
}

type RequestOptions = Parameters<typeof generateRelatedTopics>[0];

/** サーバーは 50 秒で諦めて返す。通信が止まったまま戻らないとき（電波・公衆 Wi-Fi のログイン画面など）だけ、こちらで切る */
const CLIENT_TIMEOUT_MS = 70_000;


/** AI が答えず、図鑑の語も足りなかったときのお知らせ（定型の候補は出さずに、再試行をお願いする） */
export function retryLaterMessage(kind: string | undefined, ownKey = false): string {
  if (kind === "key") return "自分の AI キーが使えませんでした。設定の「自分の AI キー」で接続テストをしてみてください。";
  if (kind === "quota") {
    return ownKey
      ? "自分の AI キーの利用上限に達しました。時間を置いてから、もう一度お試しください。"
      : "みんなで分け合っている AI の利用上限に達しました。時間を置くか、設定の「自分の AI キー」に無料のキーを入れると続けられます。";
  }
  if (kind === "rate") return "続けてたくさん広げたので、少し時間を置いてから、もう一度お試しください。";
  return "AI から返事がありませんでした。しばらく時間を置いてから、もう一度お試しください。";
}

/**
 * AI を呼んだのに語が1つも取れず（キーが無いだけの公開版は除く）、図鑑の語も必要な数に届かないなら、
 * 定型の組み合わせで埋めずに諦める（意味の薄い候補を並べるより、再試行してもらう方がよい）
 */
function withRetryLater(result: GenerateResult, known: number, need: number, ownKey: boolean): GenerateResult {
  if (result.source !== "mock" || !result.warning || known >= need) return result;
  return { ...result, retryLater: true, warning: retryLaterMessage(result.noticeKind, ownKey) };
}

/** サーバーに頼む本体。届いた語は onTopic で先に知らせ、足りない分は mock で埋める */
async function requestTopics(
  options: RequestOptions,
  /**
   * known: mock の先頭のうち図鑑から持ってきた語の数（残りは定型の組み合わせ）。
   * recordSeed: AI の結果を自分の図鑑に残すときのお題（無ければ残さない）
   */
  plan: { count: number; context: string[]; mode: BoardMode; mock: string[]; known: number; recordSeed?: string; detail: boolean },
): Promise<GenerateResult> {
  const { count, context, mode, mock, known, recordSeed, detail } = plan;
  const need = Math.min(count, options.minimum ?? count);
  const override = sanitizeSecret(options.apiKey);
  const streamed: string[] = [];
  const accept = (label: unknown) => {
    if (typeof label !== "string" || isJunkTopic(label) || streamed.includes(label) || streamed.length >= count) return;
    streamed.push(label);
    options.onTopic?.(label);
  };
  const finish = (json: Partial<GenerateResult>): GenerateResult => {
    const parsed = (Array.isArray(json.topics) ? json.topics : []).filter(
      (item): item is string => typeof item === "string" && !isJunkTopic(item),
    );
    const fromAi = json.source === "gemini" && (parsed.length > 0 || streamed.length > 0);
    // 流れてきた順を優先し、足りない分を最終結果・オフライン候補で埋める。
    // AI が使えなかったときのサーバーの候補は定型なので、図鑑を先に使う手元の候補で置き換える
    // サーバーの答えも後ろは埋め合わせのことがあるので、AI の語は先頭の aiCount 語だけ
    const aiTopics = fromAi ? [...streamed, ...parsed.slice(0, json.aiCount ?? parsed.length)] : [];
    const topics = padTopics(streamed, [...(fromAi ? parsed : []), ...mock], count, options.seed, detail);
    if (aiTopics.length > 0 && recordSeed) rememberTopics(recordSeed, aiTopics, mode);
    markFillers(options.seed, topics.filter((label) => !aiTopics.includes(label)), mode);
    const result = withRetryLater(
      {
        topics,
        source: fromAi ? "gemini" : "mock",
        warning: json.warning,
        noticeKind: json.noticeKind,
        debug: json.debug,
        usage: json.usage,
      },
      known,
      need,
      Boolean(override),
    );
    recordAiUsage(result);
    return result;
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  try {
    const response = await fetch(apiPath("/api/gemini"), {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seed: options.seed,
        existing: options.existing,
        model: options.model?.trim() || DEFAULT_MODEL,
        count,
        minimum: options.minimum,
        preferred: options.preferred ?? [],
        context,
        mixFrom: options.mixFrom?.length ? options.mixFrom : undefined,
        mode,
        detail: detail || undefined,
        apiKey: override || undefined,
        stream: true,
      }),
    });
    if (isNoServerResponse(response)) {
      // GitHub Pages（サーバーの無い公開版）はオフライン生成が普通の動きなので、何も知らせない
      markFillers(options.seed, mock, mode);
      return { topics: mock, source: "mock" };
    }
    if (!response.ok) throw new Error(`gemini proxy ${response.status}`);

    const isStream = (response.headers.get("content-type") ?? "").includes("ndjson") && response.body;
    if (!isStream) return finish((await response.json()) as GenerateResult);

    reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let done: Partial<GenerateResult> | null = null;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = JSON.parse(line) as StreamLine;
        if (parsed.type === "topic") accept(parsed.label);
        else if (parsed.type === "stage") {
          if (parsed.stage === "switch" || parsed.stage === "retry") options.onStage?.(parsed.stage);
        } else if (parsed.type === "done") done = parsed;
      }
    }
    if (buffer.trim()) {
      const parsed = JSON.parse(buffer) as StreamLine;
      if (parsed.type === "done") done = parsed;
    }
    return finish(done ?? { source: streamed.length ? "gemini" : "mock" });
  } catch {
    if (streamed.length > 0) return finish({ source: "gemini" });
    markFillers(options.seed, mock, mode);
    return withRetryLater(
      {
        topics: mock,
        source: "mock",
        warning: "AI に届かなかったので、今回はオフラインの候補で広げました。",
        noticeKind: "unavailable",
        debug: { reason: "proxy", host: "local", model: options.model?.trim() || DEFAULT_MODEL },
      },
      known,
      need,
      Boolean(override),
    );
  } finally {
    clearTimeout(timer);
    // 途中で読むのをやめたとき（壊れた行・時間切れ）に、通信を開いたままにしない
    void reader?.cancel().catch(() => undefined);
  }
}
