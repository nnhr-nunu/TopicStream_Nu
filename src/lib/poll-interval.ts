/**
 * 読み直しの間隔。人が増えると先に尽きる無料の枠（YouTube の 1 日のユニット・Redis の帯域）を、
 * 静かなときだけ少し節約する。配信で一番の見せ場（番号を打つとカードが光る）を鈍らせない範囲にとどめる。
 */

/** YouTube のコメントの、ふだんの読み直しの間隔（サーバーが YouTube の指定より短くしない） */
export const YOUTUBE_POLL_MS = 8_000;
/** 新しいコメントが無い回がこれだけ続いたら（ふだんの間隔で約 40 秒）、間隔を延ばす */
export const YOUTUBE_QUIET_POLLS = 5;
/** 静かなときの間隔。小さい配信で、番号を打ってから光るまでが長くなりすぎないよう 16 秒まで */
export const YOUTUBE_QUIET_POLL_MS = 16_000;

/** 次に YouTube のコメントを読むまで。quietPolls は新しいコメントが無かった回の続いた数（届いたら 0 に戻す） */
export function nextYoutubePollMs(serverMs: number | undefined, quietPolls: number): number {
  const base = serverMs ?? YOUTUBE_POLL_MS;
  return quietPolls >= YOUTUBE_QUIET_POLLS ? Math.max(base, YOUTUBE_QUIET_POLL_MS) : base;
}

/** いっしょに見る画面の、ふだんの読み直しの間隔（OBS に映す画面は、配信していない間のほかはいつもこれ） */
export const WATCH_POLL_MS = 2_500;
/** 盤面が変わらない回がこれだけ続いたら、見る人の画面だけ間隔を延ばす */
export const WATCH_QUIET_POLLS = 4;
export const WATCH_QUIET_POLL_MS = 5_000;

/**
 * 盤面がこれだけ変わらなければ、配信していないとみなす（OBS に入れたままの画面が、配信のない間も読み続けないように。
 * OBS のブラウザソースはシーンに出ていなくても動き続け、2.5 秒ごとだと 1 日で数万回 Redis を読む）
 */
export const WATCH_IDLE_AFTER_MS = 10 * 60_000;
/** 配信していない間の間隔。配信を再開してから最初の変化が映るまで、長くてもこれだけ */
export const WATCH_IDLE_POLL_MS = 30_000;

/** 次にいっしょに見る盤面を読むまで。unchanged は盤面が変わらなかった回の続いた数、idleMs は最後に盤面が変わってからの時間 */
export function nextWatchPollMs(unchanged: number, obs: boolean, idleMs = 0): number {
  if (idleMs >= WATCH_IDLE_AFTER_MS) return WATCH_IDLE_POLL_MS;
  return !obs && unchanged >= WATCH_QUIET_POLLS ? WATCH_QUIET_POLL_MS : WATCH_POLL_MS;
}

/** 配信待ち（まだライブチャットが開いていない）がこれだけ続いたら、読む間隔を延ばす */
export const YOUTUBE_WAITING_LONG_AFTER_MS = 10 * 60_000;
/** 長く待っているときの間隔（videos.list の 1 日のユニットを節約。配信が始まってから読み始めるまで、長くてもこれだけ） */
export const YOUTUBE_WAITING_LONG_POLL_MS = 3 * 60_000;

/** 配信待ちの次の読み直しまで。waitingMs は待ち始めてからの時間 */
export function nextWaitingPollMs(serverMs: number | undefined, waitingMs: number): number {
  const base = serverMs ?? 30_000;
  return waitingMs >= YOUTUBE_WAITING_LONG_AFTER_MS ? Math.max(base, YOUTUBE_WAITING_LONG_POLL_MS) : base;
}
