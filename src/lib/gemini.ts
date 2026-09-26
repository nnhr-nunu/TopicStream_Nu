import { CHILD_COUNT, DEFAULT_MODEL } from "@/lib/constants";
import { sanitizeSecret } from "@/lib/env-secret";
import { detailRecordSeed, mockDetailTopics } from "@/lib/detail-modes";
import { isJunkTopic, padTopics } from "@/lib/gemini-core";
import { fetchSharedRelated, recallTopicsNow, rememberTopics } from "@/lib/knowledge-client";
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
  preferred?: string[];
  context?: string[];
  mode?: BoardMode;
  onTopic?: (label: string) => void;
  recall?: boolean;
  detail?: boolean;
}): Promise<GenerateResult> {
  const count = options.count ?? CHILD_COUNT;
  const context = options.context ?? [];
  const mode = parseMode(options.mode);
  if (options.detail) {
    const mock = mockDetailTopics(options.seed, options.existing, count, mode, context);
    return requestTopics(options, { count, context, mode, mock, recordSeed: detailRecordSeed(options.seed, context), detail: true });
  }
  // 「一番の失敗談」のような汎用の切り口は、図鑑にもこのお題としてはためない（別のお題の話が混ざる）
  const generic = isGenericAngle(options.seed);
  // 図鑑はモードごとに分かれている（お悩み相談の語が雑談の候補に混ざらない）
  const anchor = mode === "chat" ? topicAnchor(context) : undefined;
  // みんなの図鑑は待ちすぎない。間に合わなければ手元の分で進め、届いた分は次から使う
  await Promise.race([
    Promise.all([fetchSharedRelated(options.seed, mode), anchor ? fetchSharedRelated(anchor, mode) : null]),
    wait(RECALL_WAIT_MS),
  ]);
  const recalled = generic ? { topics: [], depth: 0 } : recallTopicsNow(options.seed, options.existing, count, mode);
  // このお題で図鑑が足りないときは、元のお題の語で埋める（何も無くて汎用の切り口だけになるのを避ける）
  const related =
    anchor && recalled.topics.length < count
      ? recallTopicsNow(anchor, [...options.existing, ...context], count, mode).topics
      : [];
  if (options.recall && recalled.depth >= count && recalled.topics.length >= count && Math.random() >= RECALL_AI_RATE) {
    for (const label of recalled.topics) {
      options.onTopic?.(label);
      await wait(40);
    }
    return { topics: recalled.topics, source: "knowledge" };
  }
  const mock = padTopics(
    recalled.topics,
    mockRelatedTopics(options.seed, options.existing, count, options.preferred ?? [], { context, related, mode }),
    count,
    options.seed,
  );
  return requestTopics(options, { count, context, mode, mock, recordSeed: generic ? undefined : options.seed, detail: false });
}

type RequestOptions = Parameters<typeof generateRelatedTopics>[0];

/** サーバーに頼む本体。届いた語は onTopic で先に知らせ、足りない分は mock で埋める */
async function requestTopics(
  options: RequestOptions,
  /** recordSeed: AI の結果を自分の図鑑に残すときのお題（無ければ残さない） */
  plan: { count: number; context: string[]; mode: BoardMode; mock: string[]; recordSeed?: string; detail: boolean },
): Promise<GenerateResult> {
  const { count, context, mode, mock, recordSeed, detail } = plan;
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
    const topics = padTopics(streamed, [...(fromAi ? parsed : []), ...mock], count, options.seed, detail);
    if (fromAi && recordSeed) rememberTopics(recordSeed, [...streamed, ...parsed], mode);
    return {
      topics,
      source: fromAi ? "gemini" : "mock",
      warning: json.warning,
      noticeKind: json.noticeKind,
      debug: json.debug,
    };
  };

  try {
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seed: options.seed,
        existing: options.existing,
        model: options.model?.trim() || DEFAULT_MODEL,
        count,
        preferred: options.preferred ?? [],
        context,
        mode,
        detail: detail || undefined,
        apiKey: override || undefined,
        stream: true,
      }),
    });
    if (response.status === 404) {
      // GitHub Pages（サーバーの無い公開版）はオフライン生成が普通の動きなので、何も知らせない
      return { topics: mock, source: "mock" };
    }
    if (!response.ok) throw new Error(`gemini proxy ${response.status}`);

    const isStream = (response.headers.get("content-type") ?? "").includes("ndjson") && response.body;
    if (!isStream) return finish((await response.json()) as GenerateResult);

    const reader = response.body!.getReader();
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
        else if (parsed.type === "done") done = parsed;
      }
    }
    if (buffer.trim()) {
      const parsed = JSON.parse(buffer) as StreamLine;
      if (parsed.type === "done") done = parsed;
    }
    return finish(done ?? { source: streamed.length ? "gemini" : "mock" });
  } catch {
    if (streamed.length > 0) return finish({ source: "gemini" });
    return {
      topics: mock,
      source: "mock",
      warning: "AI に届かなかったので、今回はオフラインの候補で広げました。",
      noticeKind: "unavailable",
      debug: { reason: "proxy", host: "local", model: options.model?.trim() || DEFAULT_MODEL },
    };
  }
}
