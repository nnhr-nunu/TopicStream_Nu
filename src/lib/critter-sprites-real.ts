/**
 * 待ち時間の動物の「リアル」な絵（空のカードの中を歩く）。
 * 手で1ドットずつ描く代わりに、楕円・多角形・線で形を描き、陰影と輪郭を自動で付ける（pixel-draw.ts）。
 * 形を直すときは数字を変え、ブラウザで ?critter=frog-real のように付けて見た目を確かめる
 */
import type { Sprite } from "@/lib/critter-sprite";
import { moreRealSprites } from "@/lib/critter-sprites-real-more";
import { pixelCanvas, shadedSprite } from "@/lib/pixel-draw";

// ---- カエル（横向きに座る。緑の体・クリーム色の腹・金色の目・背中の斑点） ----

function frogFrame(pose: "sit" | "jump"): string[] {
  const c = pixelCanvas(28, 18);
  if (pose === "jump") {
    // 体を前へ伸ばし、後ろ脚をまっすぐ後ろへ
    c.poly([[5, 11], [8, 7.5], [13, 5.5], [19, 5], [23, 6], [26.5, 8], [25.5, 9.8], [21, 11], [15, 12], [9, 12.5]], "G");
    c.line(8, 10.5, 3.5, 13.5, "T", 3.2).line(3.5, 13.5, 1.2, 16, "T", 1.8).line(1.5, 16, 5, 16.3, "T", 1.4);
    c.line(21, 10.5, 24.5, 14.5, "G", 1.8).line(24, 14.8, 26.5, 15.2, "G", 1.2);
    c.ellipse(19.5, 4.6, 2.9, 2.5, "G");
    c.poly([[14, 10], [24, 9.2], [21, 11.2], [15, 12]], "C", "G");
    c.line(18, 9.3, 26, 8.4, "m", 1);
    c.ellipse(19.5, 4.7, 1.9, 1.7, "Y").ellipse(19.9, 4.8, 1.05, 0.75, "K").dot(19, 4, "W");
    c.dot(25, 7, "m").dot(12, 7, "S").dot(15, 6, "S").dot(9, 9, "S").dot(10, 9, "S");
    return c.rows();
  }
  c.poly(
    [[2, 13], [3, 9], [6, 6], [11, 4.2], [17, 3.6], [21, 4], [24, 5.5], [26.5, 7.2], [26, 8.7], [22, 10.2], [18, 11.5], [15, 13.5], [10, 15], [4, 15]],
    "G",
  );
  c.ellipse(19.5, 3.6, 3, 2.6, "G");
  // 折りたたんだ後ろ脚（もも）と、前へ伸びる足先
  c.ellipse(8.2, 11.6, 5.6, 3.7, "T");
  c.poly([[4, 14.4], [15.5, 14.2], [17.5, 16.3], [5, 16.5]], "T");
  // 前脚
  c.line(19, 10, 18.6, 15.2, "G", 2.1);
  c.poly([[16.8, 15.2], [21.2, 15.2], [21.8, 16.4], [16.4, 16.4]], "G");
  // のど・お腹
  c.poly([[14, 9.8], [25, 8.2], [22.5, 10.4], [18.2, 11.8], [15, 13.4], [13, 12.5]], "C", "G");
  // 口・目・鼻・斑点
  c.line(17, 9, 26, 7.9, "m", 1);
  c.ellipse(19.5, 3.7, 2, 1.8, "Y").ellipse(19.9, 3.8, 1.05, 0.78, "K").dot(19, 3, "W");
  c.dot(25, 6, "m").dot(10, 6, "S").dot(11, 6, "S").dot(14, 5, "S").dot(6, 9, "S").dot(9, 10, "S").dot(12, 8, "S");
  return c.rows();
}

const frog = () => shadedSprite(
  1.5,
  {
    o: "#1f3d33",
    g: "#3f7d45",
    G: "#5ea85a",
    h: "#8fcf7a",
    c: "#c9b77c",
    C: "#e8dca4",
    e: "#f6efcc",
    S: "#356b3a",
    Y: "#e8b83a",
    K: "#1a1a1a",
    W: "#ffffff",
    m: "#2c4a34",
  },
  { shade: { G: "gGh", T: "gGh", C: "cCe" }, outline: "o" },
  { sit: frogFrame("sit"), jump: frogFrame("jump") },
);

// ---- ペンギン（コウテイペンギン。黒い背中・白いお腹・首の黄色・オレンジの足） ----

function penguinFrame(step: 0 | 1 | 2): string[] {
  const c = pixelCanvas(17, 31);
  c.poly([[4, 8], [11, 7.5], [13.2, 13], [13.8, 20], [12.6, 25.5], [9.5, 28.3], [5, 28.3], [2.8, 24.5], [2.4, 17], [3, 11]], "B");
  c.ellipse(8.6, 5.6, 3.9, 3.8, "B");
  // くちばし（下にオレンジの筋）
  c.poly([[11.2, 5], [16, 6.4], [11.6, 7.2]], "k");
  c.line(12, 6.9, 15.3, 6.6, "O", 0.9);
  // 白いお腹と、首の黄色
  c.poly([[9.6, 9.2], [12.3, 12], [13.3, 18], [12.8, 24], [10.4, 27.4], [7.2, 27.5], [7.8, 20], [8.4, 13]], "W");
  c.ellipse(10.3, 8.9, 1.6, 2.2, "Y");
  c.ellipse(10.8, 11.2, 1.8, 1.4, "y", "W");
  // 羽（フリッパー）
  c.poly([[4.8, 11.5], [7.4, 12.6], [7.8, 19.5], [6.2, 24.5], [4.4, 20]], "F");
  c.dot(10, 5, "K");
  // 足（歩くたびに前後）
  const [front, back] = step === 1 ? [6.4, 10] : step === 2 ? [9.6, 6.8] : [7.2, 9.4];
  c.ellipse(back, 29.2, 1.9, 0.9, "q").ellipse(front, 29.3, 2, 0.95, "O");
  return c.rows();
}

const penguin = () => shadedSprite(
  1.45,
  {
    o: "#0e1016",
    b: "#15171d",
    B: "#23262e",
    c: "#3d4452",
    F: "#1b1d24",
    v: "#b9c4d4",
    W: "#eef1f5",
    u: "#ffffff",
    Y: "#f3b53d",
    y: "#fbe7a6",
    k: "#16181e",
    O: "#e9803a",
    q: "#b8612b",
    K: "#050608",
  },
  { shade: { B: "bBc", W: "vWu", F: "bFc" }, outline: "o", outlineFor: { O: "q" } },
  { stand: penguinFrame(0), walk0: penguinFrame(1), walk1: penguinFrame(2) },
);

// ---- ねこ（キジトラ。横向きに歩く・座る） ----

function catFrame(pose: "walk0" | "walk1" | "walk2" | "sit" | "blink"): string[] {
  const c = pixelCanvas(33, 21);
  const ground = 19.4;
  const leg = (x0: number, y0: number, x1: number, region: string) => {
    c.line(x0, y0, x1, ground - 0.8, region, 2);
    c.ellipse(x1 + 0.5, ground - 0.5, 1.3, 0.8, region);
  };
  if (pose === "sit" || pose === "blink") {
    // 座って前を向く（しっぽは前に巻く）
    c.ellipse(19, 13.5, 5.2, 5.6, "B");
    c.poly([[16, 18.8], [26, 18.8], [24, 11], [18, 10]], "B");
    c.line(14, 18.6, 7, 18.2, "B", 2.2).line(7, 18.2, 5.2, 16.5, "B", 2);
    c.ellipse(24.5, 6.5, 3.9, 3.5, "B");
    c.poly([[21.8, 4.3], [22.6, 0.8], [24.8, 3.2]], "B").poly([[25.5, 3.2], [27.6, 0.8], [28, 4.6]], "B");
    c.ellipse(27.4, 8, 1.9, 1.5, "C");
    c.ellipse(23.5, 13.5, 2.4, 4.4, "C", "B");
    leg(22.8, 13, 22.6, "B");
    leg(25.2, 13, 25.4, "B");
    c.line(18, 9.5, 21.5, 10.5, "S", 1).line(15, 13, 16.5, 15.5, "S", 1).line(16, 11, 18, 13, "S", 1);
    c.line(9, 18.2, 9.5, 17.2, "S", 1).line(11.5, 18.4, 12, 17.3, "S", 1);
    c.dot(22, 3, "S").dot(24, 2.8, "S").dot(23, 3.6, "S");
    const eye = pose === "blink" ? "S" : "E";
    c.dot(23.5, 6, eye).dot(26.5, 6, eye).dot(28.5, 7.3, "p");
    return c.rows();
  }
  const phase = pose === "walk1" ? 1 : pose === "walk2" ? 2 : 0;
  // 奥の脚（暗い）→ 体・胸・頭・耳・しっぽ → 手前の脚
  leg(8.5, 12, [6.5, 8.5, 10.5][phase]!, "D");
  leg(21.5, 12, [23.5, 21.5, 19.5][phase]!, "D");
  c.ellipse(14.5, 10.4, 9.5, 4.3, "B");
  c.ellipse(22, 10.3, 4.1, 4.2, "B");
  c.poly([[22, 7], [25.5, 5], [27, 9.5], [24.5, 12]], "B");
  c.ellipse(26.8, 6.2, 3.7, 3.3, "B");
  c.poly([[24.2, 3.8], [24.9, 0.6], [26.8, 3.1]], "B").poly([[27.4, 3.2], [29.4, 0.9], [29.6, 4.6]], "B");
  c.ellipse(29.6, 7.6, 1.8, 1.4, "C");
  c.ellipse(24.6, 11.2, 1.9, 2.2, "C", "B");
  c.line(6.5, 9, 3.6, 7.2, "B", 2.6).line(3.6, 7.2, 2.6, 4.2, "B", 2.5).line(2.6, 4.2, 3.8, 1.8, "B", 2.3);
  leg(10.5, 12, [12.5, 10.5, 8.5][phase]!, "B");
  leg(23.5, 12, [21.5, 23.5, 25.5][phase]!, "B");
  // しま模様
  for (const [x, len] of [
    [8.5, 2.2],
    [11.5, 2.8],
    [14.5, 2.4],
    [17.5, 2.8],
    [20, 2],
  ] as const) {
    c.line(x, 6.6, x + 0.6, 6.6 + len, "S", 1);
  }
  c.line(3, 6.4, 4.6, 7.6, "S", 1).line(2.2, 3.8, 3.8, 3.9, "S", 1).dot(3.6, 1.6, "S");
  c.dot(25, 3.8, "S").dot(26.5, 3.4, "S").dot(25.8, 4.3, "S");
  c.dot(27.6, 5.7, "E").dot(28.4, 5.7, "E").dot(31, 7, "p");
  return c.rows();
}

const cat = () => shadedSprite(
  1.45,
  {
    o: "#3b2d24",
    b: "#7d6650",
    B: "#a98d6c",
    c: "#c9ae8c",
    d: "#5e4c3c",
    D: "#7a6450",
    f: "#8f7860",
    C: "#eadbc2",
    v: "#c7b69c",
    u: "#f7efe2",
    S: "#5b4636",
    E: "#9dbb3e",
    p: "#d98c8c",
  },
  { shade: { B: "bBc", D: "dDf", C: "vCu" }, outline: "o" },
  { walk0: catFrame("walk0"), walk1: catFrame("walk1"), walk2: catFrame("walk2"), sit: catFrame("sit"), blink: catFrame("blink") },
);

// ---- うさぎ（野うさぎ。止まると耳がぴくっ、跳ぶと伸びる） ----

function rabbitFrame(pose: "sit" | "ear" | "hop"): string[] {
  const c = pixelCanvas(28, 21);
  if (pose === "hop") {
    c.ellipse(12.5, 11, 8.5, 4.4, "B");
    c.ellipse(21, 8.5, 3.9, 3.3, "B").ellipse(24.2, 9.3, 1.7, 1.4, "B");
    c.poly([[18.4, 6.8], [13.5, 3.2], [13, 4.4], [17.5, 8.2]], "B").poly([[19.6, 6.4], [15.5, 2.2], [15, 3.4], [19, 7.6]], "B");
    c.line(8, 12.5, 2.5, 16, "T", 3).line(2.5, 16, 0.8, 18.8, "T", 1.8);
    c.line(19.5, 11.5, 24, 15.5, "B", 1.8).line(24, 15.5, 25.8, 16.4, "B", 1.3);
    c.ellipse(3.8, 9.3, 1.8, 1.5, "W");
    c.ellipse(15, 13.4, 5, 1.8, "C", "B");
    c.line(14, 3.6, 17.2, 6.6, "P", 0.8);
    c.dot(21.8, 7.8, "K").dot(21.5, 7.4, "W").dot(25.4, 8.8, "p");
    return c.rows();
  }
  c.ellipse(11.5, 13.4, 8.3, 5.4, "B");
  c.ellipse(8.4, 14.6, 5.2, 4, "T");
  c.ellipse(11.8, 18.6, 4.8, 1.1, "T");
  c.ellipse(20.5, 9.2, 4.2, 3.6, "B").ellipse(23.7, 10.3, 1.8, 1.5, "B");
  c.poly([[17.2, 12], [21, 10], [22.5, 14.5], [19, 16]], "B");
  // 耳（止まると前の耳がぴくっと前へ）
  c.poly([[17.8, 7], [16.2, 1.2], [17.6, 0.6], [19.6, 6.4]], "B");
  if (pose === "ear") c.poly([[19.3, 6.4], [21.8, 1.2], [23.2, 1.8], [21, 7]], "B");
  else c.poly([[19.3, 6.4], [19.6, 0.8], [21.1, 1], [20.9, 6.6]], "B");
  c.line(17.2, 1.8, 18.4, 5.6, "P", 0.8);
  // 前脚・しっぽ・お腹
  c.line(19.6, 14, 20.4, 18.6, "B", 1.9).ellipse(21, 19, 1.5, 0.8, "B");
  c.ellipse(3.3, 12, 1.9, 1.7, "W");
  c.ellipse(19.5, 13.8, 2, 2.4, "C", "B");
  c.dot(21.4, 8.4, "K").dot(21.4, 9, "K").dot(21, 8.2, "W").dot(25.2, 9.8, "p");
  return c.rows();
}

const rabbit = () => shadedSprite(
  1.45,
  {
    o: "#3a2a1e",
    b: "#7e5a3c",
    B: "#a57a52",
    c: "#c89e72",
    C: "#eadcc6",
    v: "#cdbb9e",
    u: "#f8f0e2",
    W: "#fbfaf6",
    w: "#d9d4ca",
    x: "#ffffff",
    P: "#d9a0a0",
    K: "#1c1410",
    p: "#b86a6a",
  },
  { shade: { B: "bBc", T: "bBc", C: "vCu", W: "wWx" }, outline: "o" },
  { sit: rabbitFrame("sit"), ear: rabbitFrame("ear"), hop: rabbitFrame("hop") },
);

// ---- 蝶々（アゲハチョウ。上から見て、羽を開く → 半分 → 閉じる） ----

function butterflyFrame(span: number): string[] {
  const c = pixelCanvas(25, 19);
  const mid = 12.5;
  const side = (x: number) => mid - (mid - x) * span;
  const wing = (points: [number, number][], region: string) => {
    const left = points.map(([x, y]): [number, number] => [side(x), y]);
    c.poly(left, region).poly(
      left.map(([x, y]): [number, number] => [2 * mid - x, y]),
      region,
    );
  };
  // 前の羽・後ろの羽（しっぽ付き）
  wing([[mid - 0.5, 7.5], [1.5, 2], [0.8, 4.5], [3, 9.2], [mid - 0.5, 9.8]], "Y");
  wing([[mid - 0.5, 9.8], [5, 10.5], [4.2, 14], [6.2, 16], [6.6, 18.2], [8, 16.4], [mid - 0.5, 12.8]], "Y");
  // 黒い筋と縁
  const vein = (x0: number, y0: number, x1: number, y1: number, width = 1) => {
    c.line(side(x0), y0, side(x1), y1, "K", width, "Y");
    c.line(2 * mid - side(x0), y0, 2 * mid - side(x1), y1, "K", width, "Y");
  };
  vein(1.5, 2, 0.8, 4.5, 1.6);
  vein(0.8, 4.5, 3, 9.2, 1.6);
  vein(mid - 0.5, 7.4, 2, 2.4);
  vein(9, 8.2, 4, 7.5);
  vein(8, 9.4, 3.2, 8.8);
  vein(4.2, 14, 6.4, 16.8, 1.6);
  vein(5, 10.5, 4.2, 14, 1.6);
  vein(mid - 0.5, 12, 6, 12.5);
  // 後ろの羽の青と橙の紋
  for (const [x, y, region] of [
    [5.2, 14.3, "U"],
    [6.6, 15, "U"],
    [7.6, 15.6, "R"],
  ] as const) {
    c.dot(side(x), y, region).dot(2 * mid - side(x) - 0.01, y, region);
  }
  // 胴と触角
  c.line(mid, 5.5, mid, 15.5, "k", 1.6);
  c.line(mid - 0.3, 5.2, mid - 2.4, 1, "a", 0.8).line(mid + 0.3, 5.2, mid + 2.4, 1, "a", 0.8);
  return c.rows();
}

const butterfly = () => shadedSprite(
  1.35,
  { o: "#2a2420", y: "#e0b94a", Y: "#f6d768", z: "#fff1a8", K: "#221c18", U: "#4f86d9", R: "#e8663a", k: "#2b2420", a: "#3a302a" },
  { shade: { Y: "yYz" }, outline: "o", bare: "a" },
  { open: butterflyFrame(1), mid: butterflyFrame(0.55), shut: butterflyFrame(0.18) },
);

// ---- にわとり（赤茶の雌鶏）とひよこ ----

function henFrame(pose: "walk0" | "walk1" | "peck"): string[] {
  const c = pixelCanvas(27, 24);
  const ground = 22.8;
  const legs = (...pairs: [number, number][]) => {
    for (const [x0, x1] of pairs) {
      c.line(x0, 17.5, x1, ground - 0.6, "L", 1.3);
      c.line(x1 - 0.8, ground - 0.4, x1 + 2, ground - 0.4, "L", 1);
    }
  };
  if (pose === "peck") {
    legs([10, 10], [13, 13]);
    c.ellipse(12, 13, 7.8, 5.2, "B");
    c.poly([[4.6, 12], [1.5, 5.5], [4, 4.8], [8.5, 9.5]], "T");
    c.poly([[16, 10], [20.5, 13], [22.5, 18], [19.5, 19.5], [16, 15]], "B");
    c.ellipse(21, 17.8, 2.5, 2.3, "B");
    c.ellipse(20.2, 15.3, 1.3, 0.9, "R").ellipse(21.8, 15.3, 1, 0.9, "R");
    c.poly([[22.5, 18.2], [24, 21], [21.8, 19.6]], "y");
    c.dot(22, 17.4, "K");
  } else {
    legs(pose === "walk1" ? [9, 8] : [10, 11.5], pose === "walk1" ? [13, 14.5] : [13, 12.5]);
    c.ellipse(12, 13, 7.8, 5.6, "B");
    c.poly([[4.8, 11.5], [1.8, 4.5], [4.5, 3.8], [8.6, 9]], "T");
    c.line(2.8, 5, 5.5, 9.5, "t", 1);
    c.poly([[15.5, 9.5], [16.8, 4.5], [21, 3.6], [22, 7.4], [19.5, 12.5]], "B");
    c.ellipse(19.6, 5.2, 2.9, 2.6, "B");
    c.ellipse(18.6, 2.3, 1.1, 1.2, "R").ellipse(20, 1.9, 1.1, 1.3, "R").ellipse(21.3, 2.5, 1, 1.1, "R");
    c.ellipse(21.5, 7.8, 0.8, 1.3, "R");
    c.poly([[22, 4.8], [24.8, 5.6], [22, 6.4]], "y");
    c.dot(20.6, 4.7, "K");
  }
  // 羽と、羽の重なり
  c.ellipse(11.8, 12.6, 5, 3.1, "W");
  c.line(8, 12.9, 14.5, 13.5, "w", 1).line(8.5, 14.5, 14, 14.8, "w", 1);
  return c.rows();
}

const hen = () => shadedSprite(
  1.4,
  {
    o: "#3a1f14",
    b: "#8a4526",
    B: "#b0603a",
    c: "#cf8458",
    T: "#5a2e1c",
    d: "#4a2616",
    e: "#74402a",
    t: "#8a5236",
    W: "#9c5230",
    v: "#7f3f22",
    x: "#bf7650",
    w: "#7a3b1e",
    R: "#e0402e",
    y: "#f0b040",
    L: "#e8a93c",
    K: "#140c08",
  },
  { shade: { B: "bBc", T: "dTe", W: "vWx" }, outline: "o" },
  { walk0: henFrame("walk0"), walk1: henFrame("walk1"), peck: henFrame("peck") },
);

function chickFrame(pose: "walk0" | "walk1" | "peck"): string[] {
  const c = pixelCanvas(12, 11);
  const [a, b] = pose === "walk1" ? [4, 7] : [5, 6];
  c.line(a, 8.5, a, 9.8, "O", 1).line(b, 8.5, b + 0.5, 9.8, "O", 1);
  c.ellipse(5.2, 6.4, 3.9, 3.1, "Y");
  if (pose === "peck") c.ellipse(8.4, 6.4, 2.1, 2, "Y").poly([[10, 7], [11.4, 8.4], [9.6, 8]], "O").dot(9, 5.8, "K");
  else c.ellipse(7.8, 3.9, 2.3, 2.1, "Y").poly([[9.6, 3.6], [11.4, 4.2], [9.6, 4.8]], "O").dot(8.6, 3.2, "K");
  c.ellipse(4.2, 6.6, 2, 1.3, "Z", "Y");
  return c.rows();
}

const chick = () => shadedSprite(
  1.4,
  { o: "#9a7420", y: "#e8c040", Y: "#f8dc5c", z: "#fff2a0", Z: "#f0cc48", O: "#f08a2a", K: "#1a1208" },
  { shade: { Y: "yYz" }, outline: "o" },
  { walk0: chickFrame("walk0"), walk1: chickFrame("walk1"), peck: chickFrame("peck") },
);

// ---- スズメ ----

function sparrowFrame(pose: "sit" | "peck" | "fly0" | "fly1"): string[] {
  const c = pixelCanvas(19, 15);
  const lean = pose === "peck" ? 2.5 : 0;
  if (pose === "sit" || pose === "peck") c.line(8.5, 11, 8.5, 13.4, "L", 1).line(10, 11, 10.5, 13.4, "L", 1);
  c.poly([[5, 8.5], [0.6, 10.8], [1.2, 12], [6, 10.5]], "T");
  c.ellipse(9, 8.4, 5, 3.4, "B");
  c.ellipse(10, 9.8, 3.8, 1.8, "C", "B");
  // 頭（栗色の帽子・白いほお・黒い斑点）
  c.ellipse(12.8, 5.4 + lean, 2.8, 2.6, "R");
  c.ellipse(13.5, 6.2 + lean, 1.9, 1.3, "W", "R");
  c.dot(12.8, 6.6 + lean, "K").dot(14.3, 7.2 + lean, "K").dot(14.6, 7.6 + lean, "K");
  c.poly([[15.2, 5.3 + lean], [17.2, 6.2 + lean], [15.2, 6.8 + lean]], "k");
  c.dot(13.6, 4.8 + lean, "K");
  // 羽（飛ぶときは上げ下げ）
  if (pose === "fly0") c.poly([[6, 7.5], [4.5, 1.5], [7, 0.8], [10.5, 6.8]], "S");
  else if (pose === "fly1") c.poly([[6, 9], [4, 13.5], [6.5, 14], [10, 9.5]], "S");
  else c.ellipse(8, 7.8, 3.6, 2.2, "S", "B");
  c.line(6, 7.4, 9.5, 7, "s", 1, "S").line(6.4, 8.6, 9.8, 8.4, "l", 1, "S");
  return c.rows();
}

const sparrow = () => shadedSprite(
  1.35,
  {
    o: "#2e2118",
    b: "#7a5638",
    B: "#9c7248",
    c: "#b88c60",
    T: "#5e4230",
    d: "#4a3424",
    e: "#72523a",
    C: "#d8ccb8",
    v: "#bcae98",
    u: "#ece4d6",
    R: "#8c5230",
    r: "#6e3e22",
    q: "#a86a42",
    W: "#f4f0e8",
    K: "#16100c",
    k: "#3a3430",
    S: "#6a4a30",
    s: "#3a281a",
    l: "#c9a57a",
    L: "#c49a86",
  },
  { shade: { B: "bBc", T: "dTe", C: "vCu", R: "rRq" }, outline: "o" },
  { sit: sparrowFrame("sit"), peck: sparrowFrame("peck"), fly0: sparrowFrame("fly0"), fly1: sparrowFrame("fly1") },
);

function buildRealSprites() {
  return {
    frog: frog(),
    penguin: penguin(),
    cat: cat(),
    rabbit: rabbit(),
    butterfly: butterfly(),
    hen: hen(),
    chick: chick(),
    bird: sparrow(),
    ...moreRealSprites(),
  } satisfies Record<string, Sprite>;
}

let built: ReturnType<typeof buildRealSprites> | null = null;

/** リアルな絵（作るのに少し時間がかかるので、最初に使うときに作る） */
export function realSprites(): ReturnType<typeof buildRealSprites> {
  built ??= buildRealSprites();
  return built;
}
