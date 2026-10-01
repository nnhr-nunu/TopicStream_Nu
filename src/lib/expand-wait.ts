import type { GeminiWaitStage } from "@/lib/topic-parse";

/**
 * 語がまとめて届いても、カードは REVEAL_GAP_MS ずつずらして1枚ずつ出す。
 * 2026-09-29 に試したが体感が良くなかったので止めている（届いたらすぐ出す）。true に戻せば1枚ずつに戻る
 */
export const STAGGER_REVEAL = false;
/** STAGGER_REVEAL のときの間隔（ぽこぽこ出る演出。全体の待ちはほぼ増やさない） */
export const REVEAL_GAP_MS = 180;

/**
 * 渡した処理を gapMs おきに1つずつ実行する。前の実行から gapMs 空いていれば、すぐ実行する。
 * drain は並んだ分が全部終わるのを待つ。cancel は並んだ分を捨てる（待っている drain は解く）。
 */
export function createPacer(gapMs: number, now: () => number = () => Date.now()) {
  const queue: Array<() => void> = [];
  let last = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let waiters: Array<() => void> = [];

  const settle = () => {
    const done = waiters;
    waiters = [];
    for (const resolve of done) resolve();
  };

  const pump = () => {
    timer = null;
    while (queue.length > 0) {
      const wait = last + gapMs - now();
      if (wait > 0) {
        timer = setTimeout(pump, wait);
        return;
      }
      last = now();
      queue.shift()!();
    }
    settle();
  };

  return {
    push(run: () => void) {
      queue.push(run);
      if (!timer) pump();
    },
    drain(): Promise<void> {
      if (queue.length === 0 && !timer) return Promise.resolve();
      return new Promise((resolve) => waiters.push(resolve));
    },
    cancel() {
      queue.length = 0;
      if (timer) clearTimeout(timer);
      timer = null;
      settle();
    },
  };
}

/** これより早く終わる待ちには何も出さない（すぐ返るときにお知らせがちらつかないように） */
export const WAIT_NOTE_AFTER_MS = 10_000;
/** 和ませる一言を入れ替える間隔 */
export const WAIT_QUIP_EVERY_MS = 4_000;
/** ここまで待ったら「もう少し」と伝える（全体の上限は 50 秒） */
const WAIT_LONG_MS = 35_000;

/** 待っている間に、ときどき出す一言（Discord の読み込み中の文のような、軽い冗談） */
export const WAIT_QUIPS = [
  "話題をことこと煮込んでいます🍲",
  "話題の種に水をあげています💧",
  "AI がネタ帳をめくっています📖",
  "いい話題は、じっくり育つタイプです🌱",
  "AI が言葉を選んでいます。慎重派です🤔",
  "いまのうちに、お茶を一口どうぞ🍵",
  "芽が出るまで、もう少しです🌷",
  "AI の前に行列ができています🚶",
];

/** 待っている理由（サーバーから届いた段階。届かなければ普通に考え中） */
function waitTitle(stage: GeminiWaitStage | undefined, elapsedMs: number): string {
  const seconds = Math.floor(elapsedMs / 1000);
  if (elapsedMs >= WAIT_LONG_MS) return `もう少しだけ待ってみます（${seconds}秒）`;
  if (stage === "retry") return `どの AI も混んでいるので、少し置いてもう一度聞いています（${seconds}秒）`;
  if (stage === "switch") return `混んでいたので、別の AI に聞き直しています（${seconds}秒）`;
  return `AI が話題を考えています（${seconds}秒）`;
}

/**
 * 待ち時間に応じたお知らせ。WAIT_NOTE_AFTER_MS より前は出さない（null）。
 * 見出しは今の状況（正直に）、下の一言は WAIT_QUIP_EVERY_MS ごとに入れ替える（offset で始まりをずらす）
 */
export function waitNote(
  elapsedMs: number,
  stage: GeminiWaitStage | undefined,
  offset = 0,
): { title: string; quip: string } | null {
  if (elapsedMs < WAIT_NOTE_AFTER_MS) return null;
  const turn = Math.floor((elapsedMs - WAIT_NOTE_AFTER_MS) / WAIT_QUIP_EVERY_MS);
  return { title: waitTitle(stage, elapsedMs), quip: WAIT_QUIPS[(offset + turn) % WAIT_QUIPS.length]! };
}
