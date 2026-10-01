import { toast } from "sonner";

import { WAIT_QUIPS, waitNote } from "@/lib/expand-wait";
import type { GeminiWaitStage } from "@/lib/gemini-core";
import { boardMode, isChatMode } from "@/lib/modes";
import type { Board, GenerateResult } from "@/lib/types";

/**
 * 待ちが長引いたら、今の状況（別の AI に聞き直している等）と和ませる一言を小さく出し続ける。
 * 10 秒より早く終われば何も出さない。stop で消す
 */
export function startWaitNotes(key: string) {
  const started = Date.now();
  const id = `wait-${key}`;
  const offset = Math.floor(Math.random() * WAIT_QUIPS.length);
  let stage: GeminiWaitStage | undefined;
  let shown = false;
  const tick = () => {
    const note = waitNote(Date.now() - started, stage, offset);
    if (!note) return;
    shown = true;
    toast.loading(note.title, { id, description: note.quip });
  };
  const timer = window.setInterval(tick, 1_000);
  return {
    stage(next: GeminiWaitStage) {
      stage = next;
      tick();
    },
    stop() {
      window.clearInterval(timer);
      if (shown) toast.dismiss(id);
    },
  };
}

/** AI のお知らせは同じ種類を連続で出さない（上限は再読み込みまで1回、それ以外は10分に1回） */
const noticeShownAt = new Map<string, number>();
export function showGenerateNotice(result: GenerateResult) {
  if (!result.warning) return;
  const kind = result.noticeKind ?? result.warning;
  const last = noticeShownAt.get(kind);
  const now = Date.now();
  if (last !== undefined && (kind === "quota" || now - last < 10 * 60_000)) return;
  noticeShownAt.set(kind, now);
  if (kind === "quota") toast.warning(result.warning, { duration: 8_000 });
  else toast.message(result.warning);
}

/**
 * お悩み相談などで深く広げたとき、中心のお題に寄せて広げていることを一度だけ知らせる（ボードごと・再読み込みまで）。
 * 雑談は話が広がるのが楽しいので寄せない（知らせもしない）。
 */
const anchorNoticeShown = new Set<string>();
export function showAnchorNotice(board: Board, context: string[]) {
  const root = context[context.length - 1];
  if (isChatMode(boardMode(board)) || context.length < 2 || !root || anchorNoticeShown.has(board.id)) return;
  anchorNoticeShown.add(board.id);
  toast.message(`中心の「${root}」から離れないように広げています`, {
    description: "もっと寄せたいときは、カードを中心のカードに重ねると掛け合わせられます。",
    duration: 6_000,
  });
}
