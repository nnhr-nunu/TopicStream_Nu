/**
 * 待ち時間の動物（ピクセルアート）の絵の形と、描くための小さな計算。
 * 絵そのものは critter-sprites-cute.ts（かわいい）/ critter-sprites-real.ts（リアル）
 */

/** 1文字 = 1ドット（"." は透明）。px は1ドットの大きさ（盤面の座標で）。コマはどれも同じ大きさ */
export type Sprite = { palette: Record<string, string>; frames: Record<string, string[]>; px: number };

export type PixelRun = { x: number; y: number; w: number; fill: string };

/** 絵を横に続く同じ色ごとにまとめた長方形にする（SVG の rect を減らす） */
export function spriteRuns(rows: string[], palette: Record<string, string>): PixelRun[] {
  const runs: PixelRun[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const char = row[x]!;
      let end = x + 1;
      while (end < row.length && row[end] === char) end += 1;
      const fill = palette[char];
      if (char !== "." && fill) runs.push({ x, y, w: end - x, fill });
      x = end;
    }
  });
  return runs;
}

/** 絵の大きさ（ドット数） */
export function spriteSize(sprite: Sprite): { w: number; h: number } {
  const first = Object.values(sprite.frames)[0]!;
  return { w: first[0]!.length, h: first.length };
}
