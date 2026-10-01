import { DETAIL_LABEL_MAX, LABEL_FIT_MAX } from "@/lib/constants";
import { diversifyLabels, isTruncatedLabel } from "@/lib/label-quality";
import type { BoardMode } from "@/lib/types";

/*
 * Gemini の返答（文字列）を語の配列に直す純粋な処理。fetch・環境変数・サーバー専用のコードを持たないので、
 * クライアント（gemini.ts など）からも import できる。リクエストを送る側は gemini-core.ts（ここの中身も再エクスポートしている）。
 */

/** 待ちが長引いた理由（switch: 混んでいて別のモデルに聞き直す、retry: 全部混んでいて少し置いて2巡目） */
export type GeminiWaitStage = "switch" | "retry";

/** 語の長さの上限。「具体的にする」の答えは文なので長め */
export function labelLimit(detail = false): number {
  return detail ? DETAIL_LABEL_MAX : LABEL_FIT_MAX;
}

/**
 * 上限に収まる語だけ通す。長すぎる語は「…」で切らずに捨てる
 * （切った語は、カードでも図鑑でも中途半端で、図鑑ではそれが次のお題にまでなっていた）。足りない分は他の候補で埋める。
 * 「具体的にする」の答え（文）は捨てると中身が無くなるので、上限で切る（図鑑には記録しない）
 */
function fit(label: string, max: number, sentence: boolean): string {
  const trimmed = label.trim();
  if (sentence) return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
  return trimmed.length <= max && !isTruncatedLabel(trimmed) ? trimmed : "";
}

function unwrapFences(raw: string): string {
  return raw.replace(/```(?:json|javascript|js)?/gi, "").replace(/```/g, "").trim();
}

function tryParseJsonArray(raw: string): string[] | null {
  const text = unwrapFences(raw);
  const attempts: string[] = [text];
  const bracket = text.match(/\[[\s\S]*\]/);
  if (bracket) attempts.push(bracket[0]);
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      /* 壊れた JSON は後段で拾う */
    }
  }
  return null;
}

function extractQuoted(raw: string, sentences = false): string[] {
  const out: string[] = [];
  const closed = /"((?:\\.|[^"\\])*)"/g;
  let match: RegExpExecArray | null;
  while ((match = closed.exec(raw))) {
    out.push(match[1].replace(/\\"/g, '"').replace(/\\n/g, " "));
  }
  const jp = /[「『]([^」』]+)[」』]/g;
  // 文の中の「」は語の区切りではないので、答え（文）のときは拾わない
  while (!sentences && (match = jp.exec(raw))) {
    out.push(match[1]);
  }
  if (out.length > 0) return out;
  const unclosed = raw.match(/"([^"\n\]]+)/);
  if (unclosed?.[1]) return [unclosed[1]];
  return [];
}

/** 番号・記号・引用符を外す。文（sentences）のときは、文頭・文末の「」は中身の一部なので残す */
function stripDecorations(value: string, sentences = false): string {
  let text = value.replace(/\s+/g, " ").trim();
  // 「1A 話題」「1. 話題」の番号だけ外す。「3DSの思い出」「2.5次元舞台」「23:00の配信」の数字は語の一部なので残す
  text = text.replace(/^[0-9]{1,2}[A-I](?:\s+|[:：.、]\s*)/, "");
  text = text.replace(/^[0-9]{1,2}[.)）:、](?![0-9])\s*/, "");
  text = text.replace(/^[-*・\u30fb]\s*/, "");
  const head = sentences ? /^[\s\[\]\{\}"'`]+/ : /^[\s\[\]\{\}「『"'`]+/;
  const tail = sentences ? /[\s\[\]\{\}"'`,;]+$/ : /[\s\[\]\{\}」』"'`,;]+$/;
  for (let i = 0; i < 4; i += 1) {
    const next = text.replace(head, "").replace(tail, "").trim();
    if (next === text) break;
    text = next;
  }
  return text;
}

export function isJunkTopic(label: string): boolean {
  const text = label.trim();
  if (!text) return true;
  if (/^[\[\]\{\}"'`「」『』,.:;\\/]+$/.test(text)) return true;
  if (/^[\[\]\{\}"',]/.test(text)) return true;
  if (/^[0-9]+[A-Ia-i]\s*[\[\]"']/.test(text)) return true;
  const letters = text.replace(/[\s\[\]\{\}"'`.,!?！？、。・\-…]/g, "");
  return letters.length === 0;
}

export function parseTopics(raw: string, seed: string, existing: string[], detail = false, mode: BoardMode = "chat"): string[] {
  const text = unwrapFences(raw);
  const fromJson = tryParseJsonArray(text);
  const quoted = extractQuoted(text, detail);
  const values: unknown[] =
    fromJson && fromJson.length > 0
      ? fromJson
      : quoted.length > 0
        ? quoted
        : text
            .split(detail ? /\n/ : /[\n,、]/)
            .map((part) => part.trim())
            .filter(Boolean);

  const banned = new Set([seed.trim(), ...existing.map((item) => item.trim())]);
  const topics: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const label = fit(stripDecorations(value, detail), labelLimit(detail), detail);
    if (!label || isJunkTopic(label) || banned.has(label) || topics.includes(label)) continue;
    topics.push(label);
  }
  // 答え（文）は書き出しがそろうのがふつうなので、語のときだけ整える。雑談以外は「毎朝10分〇〇」のように型がそろう語も多いので、
  // 同じ書き出しは数えず、ほぼ同じ語だけ落とす
  return detail ? topics : diversifyLabels(topics, mode === "chat" ? undefined : Infinity);
}

export function padTopics(parsed: string[], fallback: string[], count: number, seed: string, detail = false): string[] {
  const out = [...parsed];
  const banned = new Set([seed.trim(), ...out]);
  for (const item of fallback) {
    if (out.length >= count) break;
    const label = fit(stripDecorations(item, detail), labelLimit(detail), detail);
    if (!label || isJunkTopic(label) || banned.has(label)) continue;
    out.push(label);
    banned.add(label);
  }
  return out.slice(0, count);
}

export function mergeParsedTopics(base: string[], extra: string[], count: number): string[] {
  const topics = [...base];
  for (const item of extra) {
    if (topics.length >= count) break;
    if (!topics.includes(item)) topics.push(item);
  }
  return topics;
}

/** ストリームの途中で、書きかけの文字列（閉じていない "…）を切り落とす。 */
export function closedPart(text: string): string {
  let inString = false;
  let lastClosed = -1;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "\\") {
      i += 1;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      if (!inString) lastClosed = i;
    }
  }
  return inString ? text.slice(0, lastClosed + 1) : text;
}
