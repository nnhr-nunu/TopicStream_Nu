import { describe, expect, it } from "vitest";

import { boardFromTopics } from "@/lib/catalog-data";
import { POST_LIMIT, SHARE_HASHTAG, weightedPostLength } from "@/lib/share-post";
import {
  clockOf,
  currentTalk,
  formatOffset,
  originFromClock,
  rowsFrom,
  SESSION_GAP_MS,
  syncTalk,
  talkDuration,
  talkPost,
  talkSessions,
  talkTimestamps,
  type TalkEntry,
  type TalkNow,
} from "@/lib/talk-log";

const MIN = 60_000;
const T0 = new Date(2026, 8, 30, 21, 0, 0).getTime();

function now(key: string, label: string, theme = "休日の過ごし方"): TalkNow {
  return { key, label, theme };
}

/** NOW を順に切り替えた履歴を作る（[何分後, NOW]） */
function logOf(steps: [number, TalkNow | null][]): TalkEntry[] {
  let log: TalkEntry[] = [];
  steps.forEach(([minutes, value], index) => {
    log = syncTalk(log, value, T0 + minutes * MIN, `t${index}`);
  });
  return log;
}

describe("currentTalk", () => {
  it("ボードの NOW と、そのボードの最初のお題を返す", () => {
    const board = boardFromTopics("休日の過ごし方", ["昼まで寝る", "ひとりカフェ"]);
    const card = board.nodes.find((node) => node.data.label === "ひとりカフェ")!;
    const talk = currentTalk({ ...board, pinnedNodeId: card.id, pinnedAt: 123 });
    expect(talk).toEqual({ key: `${board.id}:${card.id}:123`, label: "ひとりカフェ", theme: "休日の過ごし方" });
  });

  it("NOW が無ければ null", () => {
    const board = boardFromTopics("休日の過ごし方", ["昼まで寝る"]);
    expect(currentTalk({ ...board, pinnedNodeId: null })).toBeNull();
    expect(currentTalk(null)).toBeNull();
  });
});

describe("syncTalk", () => {
  it("NOW を移すと前の行を閉じて、新しい行を足す", () => {
    const log = logOf([
      [0, now("a", "昼まで寝る")],
      [5, now("b", "ひとりカフェ")],
    ]);
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ label: "昼まで寝る", start: T0, end: T0 + 5 * MIN });
    expect(log[1]).toMatchObject({ label: "ひとりカフェ", start: T0 + 5 * MIN });
    expect(log[1]!.end).toBeUndefined();
  });

  it("同じ NOW のまま（読み込み直し・別のタブ）なら何も変えない", () => {
    const log = logOf([[0, now("a", "昼まで寝る")]]);
    expect(syncTalk(log, now("a", "昼まで寝る"), T0 + MIN, "x")).toBe(log);
  });

  it("カードの文を書き直しただけなら、行の文だけ合わせる", () => {
    const log = syncTalk(logOf([[0, now("a", "昼まで寝る")]]), now("a", "昼まで寝た話"), T0 + MIN, "x");
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ label: "昼まで寝た話", start: T0 });
  });

  it("NOW を外すと行を閉じる。何も無ければ同じ配列のまま", () => {
    const log = logOf([
      [0, now("a", "昼まで寝る")],
      [3, null],
    ]);
    expect(log[0]!.end).toBe(T0 + 3 * MIN);
    expect(syncTalk(log, null, T0 + 4 * MIN, "x")).toBe(log);
  });

  it("何時間も開いたままだった行（ブラウザを閉じた）は、終わりを書かずに次へ進む", () => {
    const stale = logOf([[0, now("a", "昼まで寝る")]]);
    const next = syncTalk(stale, now("b", "ガチャの結果", "今ハマってるゲーム"), T0 + SESSION_GAP_MS + MIN, "x");
    expect(next[0]!.end).toBeUndefined();
    expect(next[1]).toMatchObject({ label: "ガチャの結果" });
    // 別の日の配信として分かれる
    expect(talkSessions(next)).toHaveLength(2);
  });
});

describe("talkSessions", () => {
  it("ボードをまたいでも、NOW にした順の 1 本になる", () => {
    const log = logOf([
      [0, now("A:1", "昼まで寝る")],
      [4, now("B:1", "ガチャの結果", "今ハマってるゲーム")],
      [9, now("A:2", "ひとりカフェ")],
    ]);
    const [session] = talkSessions(log);
    expect(session!.rows.map((row) => row.label)).toEqual(["昼まで寝る", "ガチャの結果", "ひとりカフェ"]);
  });

  it("10 秒より短い NOW は数えず、その前後の同じ話題は 1 行にまとめる", () => {
    let log = logOf([[0, now("a", "昼まで寝る")]]);
    log = syncTalk(log, now("b", "押しまちがい"), T0 + 2 * MIN, "t1");
    log = syncTalk(log, now("a2", "昼まで寝る"), T0 + 2 * MIN + 3_000, "t2");
    log = syncTalk(log, null, T0 + 6 * MIN, "t3");
    const [session] = talkSessions(log);
    expect(session!.rows).toHaveLength(1);
    expect(session!.rows[0]).toMatchObject({ label: "昼まで寝る", start: T0, end: T0 + 6 * MIN, ids: ["t0", "t2"] });
  });

  it("間が長く空いたら別のまとまりにし、新しい順に返す", () => {
    const log = logOf([
      [0, now("a", "昼まで寝る")],
      [10, null],
      [10 + 4 * 60, now("b", "ひとりカフェ")],
    ]);
    const sessions = talkSessions(log);
    expect(sessions.map((session) => session.rows[0]!.label)).toEqual(["ひとりカフェ", "昼まで寝る"]);
  });
});

describe("talkDuration", () => {
  it("閉じた行は話した長さ、話している最後の行は今まで", () => {
    const [session] = talkSessions(
      logOf([
        [0, now("a", "昼まで寝る")],
        [5, now("b", "ひとりカフェ")],
      ]),
    );
    expect(talkDuration(session!.rows[0]!, false, T0 + 8 * MIN)).toBe(5 * MIN);
    expect(talkDuration(session!.rows[1]!, true, T0 + 8 * MIN)).toBe(3 * MIN);
    // 閉じ忘れ（長すぎる）は出さない
    expect(talkDuration(session!.rows[1]!, true, T0 + 9 * 60 * MIN)).toBeNull();
  });
});

describe("タイムスタンプ", () => {
  it("時間の書き方", () => {
    expect(formatOffset(0)).toBe("0:00");
    expect(formatOffset(12 * MIN + 34_000)).toBe("12:34");
    expect(formatOffset(62 * MIN + 3_000)).toBe("1:02:03");
  });

  const log = logOf([
    [0, now("a", "昼まで寝る")],
    [12, now("b", "ひとりカフェ")],
    [70, null],
  ]);
  const rows = talkSessions(log)[0]!.rows;

  it("配信の頭からの時間で並べる", () => {
    expect(talkTimestamps(rows, T0)).toBe("0:00 昼まで寝る\n12:00 ひとりカフェ");
  });

  it("最初の話題が 0:00 でなければ、先頭に 0:00 の行を足す（YouTube のチャプター用）", () => {
    expect(talkTimestamps(rows, T0 - 3 * MIN)).toBe("0:00 はじまり\n3:00 昼まで寝る\n15:00 ひとりカフェ");
  });

  it("配信を始める前に終わった話題は外し、始める前から話していた話題は 0:00 にする", () => {
    expect(rowsFrom(rows, T0 + 5 * MIN).map((item) => item.offset)).toEqual([0, 7 * MIN]);
    expect(talkTimestamps(rows, T0 + 20 * MIN)).toBe("0:00 ひとりカフェ");
  });

  it("最初の話題が始めて 10 秒以内なら 0:00 にし、10 秒より短い「はじまり」を作らない", () => {
    expect(talkTimestamps(rows, T0 - 7_000)).toBe("0:00 昼まで寝る\n12:07 ひとりカフェ");
  });

  it("始めてから 10 秒も残らない話題は外す（YouTube は 10 秒より短いチャプターを読まない）", () => {
    expect(talkTimestamps(rows, T0 + 12 * MIN - 3_000)).toBe("0:00 ひとりカフェ");
  });

  it("ボードをまたいだときは、どのお題の話題かも付ける", () => {
    const mixed = talkSessions(
      logOf([
        [0, now("a", "昼まで寝る")],
        [5, now("b", "ガチャの結果", "今ハマってるゲーム")],
        [9, now("c", "今ハマってるゲーム", "今ハマってるゲーム")],
      ]),
    )[0]!.rows;
    expect(talkTimestamps(mixed, T0)).toBe(
      "0:00 昼まで寝る（休日の過ごし方）\n5:00 ガチャの結果（今ハマってるゲーム）\n9:00 今ハマってるゲーム",
    );
  });
});

describe("talkPost", () => {
  it("話した話題を並べ、ハッシュタグを付ける", () => {
    const rows = talkSessions(
      logOf([
        [0, now("a", "昼まで寝る")],
        [5, now("b", "ひとりカフェ")],
      ]),
    )[0]!.rows;
    expect(talkPost(rows, T0)).toBe(`今日の配信で話したこと💬\n・昼まで寝る\n・ひとりカフェ\n\n${SHARE_HASHTAG}`);
  });

  it("多すぎるときは、X の文字数に入るところまでにして「ほか」で締める", () => {
    const steps: [number, TalkNow | null][] = Array.from({ length: 40 }, (_, index) => [
      index,
      now(`k${index}`, `とても長い話題の名前その${index}`),
    ]);
    const post = talkPost(talkSessions(logOf(steps))[0]!.rows, T0);
    // サイトのリンクを付けて投稿しても収まる
    expect(weightedPostLength(post, true)).toBeLessThanOrEqual(POST_LIMIT);
    expect(post).toContain("…ほか");
    expect(post.endsWith(SHARE_HASHTAG)).toBe(true);
  });

  it("話題が無ければ空", () => {
    expect(talkPost([], T0)).toBe("");
  });
});

describe("配信を始めた時刻", () => {
  it("まとまりの日付に当てはめる", () => {
    expect(clockOf(T0)).toBe("21:00");
    expect(originFromClock(T0 + 5 * MIN, "20:30")).toBe(T0 - 30 * MIN);
  });

  it("日付をまたぐ配信では、最初の話題に近い日を選ぶ", () => {
    const afterMidnight = new Date(2026, 9, 1, 0, 20, 0).getTime();
    expect(originFromClock(afterMidnight, "23:50")).toBe(new Date(2026, 8, 30, 23, 50, 0).getTime());
  });

  it("読めない時刻なら、最初の話題の時刻のまま", () => {
    expect(originFromClock(T0, "")).toBe(T0);
  });
});

describe("X に投稿する文の長さ", () => {
  it("最初の話題が長すぎても、上限に収まるように切る", () => {
    const long = logOf([
      [0, now("a", "あ".repeat(150))],
      [12, now("b", "ひとりカフェ")],
      [70, null],
    ]);
    const post = talkPost(talkSessions(long)[0]!.rows, T0);
    expect(weightedPostLength(post, true)).toBeLessThanOrEqual(POST_LIMIT);
    expect(post).toContain("…");
  });
});
