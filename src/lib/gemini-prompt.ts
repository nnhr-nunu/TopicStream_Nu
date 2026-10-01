import { mixOriginNote } from "@/lib/combine";
import { buildDetailPrompt } from "@/lib/detail-modes";
import { buildModePrompt } from "@/lib/modes";
import type { BoardMode } from "@/lib/types";

export function buildPrompt(
  seed: string,
  existing: string[],
  count: number,
  context: string[] = [],
  mode: BoardMode = "chat",
  detail = false,
  /** 掛け合わせのカードを広げるとき、持ってきた側のカードの祖先（近い順） */
  mixFrom: string[] = [],
): string {
  const banned = existing.slice(0, 24).join(" / ") || "なし";
  // 祖先は近い順で届くので、話の流れとして読めるよう遠い方から並べる
  const flow = context.length
    ? `
このお題は「${[...context].reverse().join(" → ")} → ${seed}」という話の流れで出てきました。流れから外れない切り口にしてください。
${anchorInstruction(mode, seed, context)}${mixOriginNote(seed, context[1], mixFrom[0])}`
    : "";
  return detail ? buildDetailPrompt(mode, seed, count, flow, banned, context) : buildModePrompt(mode, seed, count, flow, banned);
}

/**
 * 深く広げたときに、最初のお題（中心）から話がズレないようにする指示。
 * 雑談は話が広がるのが楽しいので付けない。お悩み相談などの目的があるモードは、中心の役に立つ切り口に寄せる。
 */
export function anchorInstruction(mode: BoardMode, seed: string, context: string[]): string {
  const root = context[context.length - 1];
  if (mode === "chat" || context.length < 2 || !root) return "";
  return `このボードの中心のお題は「${root}」です。「${seed}」を掘り下げつつ、どれも中心のお題「${root}」の役に立つ・つながる切り口にしてください。中心から離れた一般論にはしないでください。
`;
}
