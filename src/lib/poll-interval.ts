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

/** いっしょに見る画面の、ふだんの読み直しの間隔（OBS に映す画面はいつもこれ） */
export const WATCH_POLL_MS = 2_500;
/** 盤面が変わらない回がこれだけ続いたら、見る人の画面だけ間隔を延ばす */
export const WATCH_QUIET_POLLS = 4;
export const WATCH_QUIET_POLL_MS = 5_000;

/** 次にいっしょに見る盤面を読むまで。unchanged は盤面が変わらなかった回の続いた数 */
export function nextWatchPollMs(unchanged: number, obs: boolean): number {
  return !obs && unchanged >= WATCH_QUIET_POLLS ? WATCH_QUIET_POLL_MS : WATCH_POLL_MS;
}
