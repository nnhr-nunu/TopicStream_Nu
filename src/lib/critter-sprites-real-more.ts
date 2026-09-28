/**
 * 待ち時間の動物の「リアル」な絵のつづき（リス・金魚・柴犬・ハムスター・うま・イルカ・きつね・たぬき）。
 * 描き方は critter-sprites-real.ts と同じ（図形で形を描き、陰影と輪郭は自動）
 */
import { pixelCanvas, shadedSprite } from "@/lib/pixel-draw";

type P = [number, number];

// ---- リス（走ると尾がなびき、座るとどんぐりを持つ） ----

function squirrelFrame(pose: "sit0" | "sit1" | "run0" | "run1"): string[] {
  const c = pixelCanvas(31, 22);
  if (pose === "run0" || pose === "run1") {
    c.poly([[9, 12.5], [4, 9.5], [1, 5], [3, 2.5], [6.5, 4], [8, 7.5], [11, 10.5]], "T");
    c.ellipse(4.5, 5, 2.6, 2.3, "T");
    c.ellipse(14.5, 13, 7, 3.9, "B");
    c.ellipse(22.5, 11, 3.4, 3.1, "B").poly([[24.5, 10], [27.8, 11.8], [24.6, 13.2]], "B");
    c.poly([[21, 8.6], [21.4, 5.6], [23.2, 8]], "B");
    if (pose === "run0") c.line(10, 15, 5.5, 19.5, "B", 2).line(20, 14.5, 25, 19.2, "B", 1.8);
    else c.line(11, 15.5, 13.5, 19.8, "B", 2).line(19, 15, 16.5, 19.6, "B", 1.8);
    c.ellipse(18, 15.2, 3.5, 1.4, "C", "B");
    c.dot(23.6, 10.2, "K").dot(23.3, 9.9, "W").dot(27.4, 11.8, "k");
    return c.rows();
  }
  // 座ってどんぐりを持つ（sit1 は口元へ持ち上げる）
  c.poly([[11, 17], [6.5, 14.5], [3.5, 9], [3.8, 3.5], [7, 1], [10, 2], [9, 5.5], [9.2, 10], [12.5, 13.5]], "T");
  c.ellipse(15.5, 14.2, 4.8, 5.8, "B");
  c.ellipse(13.8, 19.6, 3.8, 1.3, "B");
  c.ellipse(18.3, 7.4, 3.3, 3.1, "B").poly([[20.2, 6.6], [23.4, 8.2], [20.2, 9.6]], "B");
  c.poly([[16.2, 5], [16.8, 1.5], [18.6, 4.6]], "B");
  c.ellipse(17.5, 14.5, 2.4, 4.5, "C", "B");
  const nut = pose === "sit1" ? 10 : 11.5;
  c.line(18.5, 12.5, 20.5, nut + 0.6, "B", 1.6);
  c.ellipse(21.4, nut + 0.6, 1.3, 1.5, "N").ellipse(21.4, nut - 0.6, 1.4, 0.8, "n");
  c.dot(19.2, 6.6, "K").dot(18.9, 6.3, "W").dot(23, 8.2, "k");
  return c.rows();
}

const squirrel = () => shadedSprite(
  1.4,
  {
    o: "#34200f",
    b: "#8a4e24",
    B: "#b86e36",
    c: "#d68e52",
    d: "#7a4420",
    T: "#a6622e",
    e: "#c98450",
    C: "#f0e2cc",
    v: "#d4c2a6",
    u: "#fbf4e8",
    N: "#b07a3e",
    n: "#6a4222",
    K: "#140c08",
    W: "#ffffff",
    k: "#2a1a10",
  },
  { shade: { B: "bBc", T: "dTe", C: "vCu" }, outline: "o" },
  { sit0: squirrelFrame("sit0"), sit1: squirrelFrame("sit1"), run0: squirrelFrame("run0"), run1: squirrelFrame("run1") },
);

// ---- 金魚（横から。尾びれをひらひら） ----

function goldfishFrame(sway: number): string[] {
  const c = pixelCanvas(27, 17);
  c.poly([[7, 8.5], [1.5, 3 + sway], [0.6, 5.6 + sway], [2.6, 8.4 + sway / 2], [0.6, 11 + sway], [1.5, 14 + sway], [7, 9.4]], "F");
  c.line(6.5, 8.6, 1.8, 4 + sway, "f", 0.8, "F").line(6.5, 9.2, 1.8, 13 + sway, "f", 0.8, "F");
  // 背びれ・腹びれ・しりびれ
  c.poly([[10, 4.4], [12.6, 1.2], [15.8, 3.8]], "F");
  c.poly([[15.5, 11.8], [14.2, 14.6], [17.4, 12.2]], "F");
  c.poly([[9.5, 12.6], [8.6, 14.6], [11.6, 12.8]], "F");
  // 体と鱗
  c.ellipse(14, 8.5, 7.4, 4.9, "R");
  c.ellipse(15.2, 10.8, 4.6, 1.8, "Y", "R");
  for (const [x, y] of [[10, 7], [12, 8.2], [14, 7], [12, 5.8], [10, 9.4], [14, 9.4]] as P[]) c.dot(x, y, "r");
  c.ellipse(18.5, 7.2, 1.3, 1.3, "W").dot(18.7, 7.2, "K");
  c.dot(21.2, 8.6, "m");
  return c.rows();
}

const goldfish = () => shadedSprite(
  1.4,
  {
    o: "#7a2412",
    R: "#f06a2e",
    q: "#c94818",
    Q: "#ff9a5a",
    Y: "#f8c070",
    y: "#e8a050",
    z: "#ffe0a8",
    F: "#ffa270",
    g: "#e87848",
    G: "#ffc8a0",
    f: "#e0602e",
    r: "#d85620",
    W: "#fff8ee",
    K: "#1a0c08",
    m: "#9a3016",
  },
  { shade: { R: "qRQ", Y: "yYz", F: "gFG" }, outline: "o" },
  { swim0: goldfishFrame(0), swim1: goldfishFrame(-1.2), swim2: goldfishFrame(1.2) },
);

// ---- 柴犬（歩く・座ってしっぽを振る） ----

function dogFrame(pose: "walk0" | "walk1" | "walk2" | "sit0" | "sit1"): string[] {
  const c = pixelCanvas(35, 24);
  const ground = 22.6;
  const leg = (x0: number, y0: number, x1: number, region: string) => {
    c.line(x0, y0, x1, ground - 0.8, region, 2.1);
    c.ellipse(x1 + 0.6, ground - 0.6, 1.4, 0.8, region);
  };
  if (pose === "sit0" || pose === "sit1") {
    const wag = pose === "sit1" ? 1.2 : 0;
    c.line(11, 15, 8.8, 12 - wag, "B", 2.6).line(8.8, 12 - wag, 9.8, 9.4 - wag, "B", 2.4).line(9.8, 9.4 - wag, 12.2, 10.2 - wag, "B", 2.2);
    c.ellipse(14.5, 17.8, 5.6, 4.6, "B");
    c.poly([[12, 20.5], [13, 12.5], [17, 8.6], [21.5, 9], [23.4, 13.5], [22.6, 21]], "B");
    c.ellipse(17.2, 21.8, 3.2, 1, "B");
    c.poly([[19.5, 9.6], [22.5, 5], [26, 5.4], [24.6, 11.4]], "B");
    c.ellipse(24.2, 6.3, 3.8, 3.4, "B");
    c.poly([[21.6, 4.2], [22, 1], [24, 3.4]], "B").poly([[24.4, 3.2], [26.6, 1.2], [26.8, 4.8]], "B");
    c.ellipse(27.4, 7.9, 2.2, 1.5, "C").ellipse(24.2, 8.2, 2.2, 1.3, "C", "B");
    c.ellipse(21.8, 14, 2.3, 4.6, "C", "B");
    c.line(21, 15, 21.2, ground - 0.6, "C", 2).line(23.2, 15, 23.6, ground - 0.6, "C", 2);
    c.dot(25.6, 5.9, "K").dot(29.4, 7.4, "k");
    return c.rows();
  }
  const phase = pose === "walk1" ? 1 : pose === "walk2" ? 2 : 0;
  leg(9, 13, [7, 9, 11][phase]!, "D");
  leg(23, 13, [25, 23, 21][phase]!, "D");
  c.ellipse(15.5, 11.8, 9.2, 4.4, "B");
  c.ellipse(23.5, 11.5, 4, 4.4, "B");
  c.poly([[23, 8.5], [26.5, 5.5], [28.5, 10], [25.5, 13]], "B");
  c.ellipse(28, 6.6, 3.9, 3.5, "B");
  c.poly([[25.4, 4.4], [26, 1], [28, 3.6]], "B").poly([[28.4, 3.4], [30.6, 1.2], [30.8, 5]], "B");
  c.ellipse(31.2, 8.4, 2.3, 1.6, "C").ellipse(28.4, 8.6, 2.2, 1.4, "C", "B");
  c.ellipse(24.8, 13.2, 2.4, 2.8, "C", "B");
  c.ellipse(16, 14.9, 6, 1.4, "C", "B");
  // 巻いたしっぽ
  c.line(7.4, 9.5, 5.4, 6.2, "B", 2.6).line(5.4, 6.2, 7, 3.6, "B", 2.4).line(7, 3.6, 9.4, 4.6, "B", 2.2).line(9.4, 4.6, 8.8, 6.8, "C", 1.6);
  leg(11, 13, [13, 11, 9][phase]!, "B");
  leg(25, 13, [23, 25, 27][phase]!, "B");
  c.dot(29.4, 5.9, "K").dot(33.3, 7.8, "k");
  return c.rows();
}

const dog = () => shadedSprite(
  1.4,
  {
    o: "#3a2210",
    b: "#b86a2a",
    B: "#d98a44",
    c: "#eeaa66",
    d: "#9a5822",
    D: "#b87236",
    f: "#cc8a4c",
    C: "#f6ead6",
    v: "#dccbb0",
    u: "#fffaf0",
    K: "#1a120c",
    k: "#1a120c",
  },
  { shade: { B: "bBc", D: "dDf", C: "vCu" }, outline: "o" },
  { walk0: dogFrame("walk0"), walk1: dogFrame("walk1"), walk2: dogFrame("walk2"), sit0: dogFrame("sit0"), sit1: dogFrame("sit1") },
);

// ---- ハムスター（ゴールデン。走る・座ってもぐもぐ） ----

function hamsterFrame(pose: "run0" | "run1" | "sit0" | "sit1"): string[] {
  const c = pixelCanvas(18, 13);
  if (pose === "sit0" || pose === "sit1") {
    const up = pose === "sit1" ? 0.6 : 0;
    c.ellipse(8, 7.4, 4.8, 4.8, "B");
    c.ellipse(9.8, 4.4, 3, 2.8, "B");
    c.ellipse(8.5, 2.2, 1, 1, "P");
    c.ellipse(9.2, 8.8, 2.8, 3, "C", "B");
    c.ellipse(12, 7 - up, 1.2, 1, "p").ellipse(13, 6.6 - up, 0.9, 1.1, "N");
    c.dot(10.8, 3.6, "K").dot(10.6, 3.3, "W").dot(12.6, 5, "k");
    c.ellipse(8.5, 11.6, 2.5, 0.7, "p");
    return c.rows();
  }
  c.ellipse(8.3, 7.3, 6.6, 3.9, "B");
  c.ellipse(12.8, 6.3, 3.3, 3, "B");
  c.ellipse(11.2, 2.9, 1.1, 1.1, "P");
  c.ellipse(9.5, 9.6, 5, 1.6, "C", "B");
  const [a, b] = pose === "run0" ? [5, 11.5] : [7, 9.5];
  c.ellipse(a, 11, 1.2, 0.8, "p").ellipse(b, 11, 1.2, 0.8, "p");
  c.dot(14, 5.4, "K").dot(13.8, 5.1, "W").dot(16, 6.6, "k");
  return c.rows();
}

const hamster = () => shadedSprite(
  1.35,
  {
    o: "#4a2a14",
    b: "#c8844a",
    B: "#e8a868",
    c: "#f6c890",
    C: "#fbf2e4",
    v: "#e4d6c0",
    u: "#ffffff",
    P: "#d88a78",
    p: "#f0b0a8",
    N: "#a07448",
    K: "#140c08",
    W: "#ffffff",
    k: "#8a4a3a",
  },
  { shade: { B: "bBc", C: "vCu" }, outline: "o" },
  { run0: hamsterFrame("run0"), run1: hamsterFrame("run1"), sit0: hamsterFrame("sit0"), sit1: hamsterFrame("sit1") },
);

// ---- うま（鹿毛。駆ける・草を食む） ----

type HorseLegs = Record<"bf" | "bb" | "nf" | "nb", [P, P, P]>;

function horseFrame(pose: "run0" | "run1" | "run2" | "graze0" | "graze1"): string[] {
  const c = pixelCanvas(43, 35);
  const ground = 33.6;
  const legPair = ([hip, knee, foot]: [P, P, P], region: string) => {
    c.line(hip[0], hip[1], knee[0], knee[1], region, 2.6);
    c.line(knee[0], knee[1], foot[0], foot[1], "m", 2);
    c.ellipse(foot[0] + 0.4, foot[1] + 0.3, 1.3, 0.8, "H");
  };
  const graze = pose === "graze0" || pose === "graze1";
  // 脚: 走りは3コマ（伸びる・集まる・中間）、草を食むときは立つ
  const standing: HorseLegs = {
    bf: [[29, 20], [29.5, 26], [29.5, ground - 1]],
    bb: [[11, 20], [10.5, 26], [11, ground - 1]],
    nf: [[31.5, 20], [32, 26], [32, ground - 1]],
    nb: [[13.5, 20], [13, 26], [13.5, ground - 1]],
  };
  const running: HorseLegs[] = [
    { bf: [[29, 20], [34, 25], [37.5, 28]], bb: [[11, 20], [6, 25], [2.5, 29]], nf: [[31.5, 20], [36, 23.5], [39.5, 26]], nb: [[13.5, 20], [9, 25.5], [5.5, 30]] },
    { bf: [[29, 20], [27, 26], [24.5, ground - 1]], bb: [[11, 20], [14, 26], [16, ground - 1]], nf: [[31.5, 20], [30, 26.5], [27, ground - 1.5]], nb: [[13.5, 20], [16.5, 26], [19, ground - 1.5]] },
    { bf: [[29, 20], [31, 26], [31, ground - 1]], bb: [[11, 20], [9, 26], [8, ground - 1]], nf: [[31.5, 20], [34, 25], [35.5, ground - 3]], nb: [[13.5, 20], [11.5, 26], [10, ground - 2]] },
  ];
  const legs = graze ? standing : running[pose === "run0" ? 0 : pose === "run2" ? 2 : 1]!;
  legPair(legs.bf, "D");
  legPair(legs.bb, "D");
  c.ellipse(20, 16, 11.5, 6.2, "B");
  c.ellipse(28.5, 16, 5, 5.8, "B");
  if (graze) {
    const nod = pose === "graze1" ? 0.8 : 0;
    c.poly([[26, 12], [31, 14], [37, 25 + nod], [34.5, 28.5 + nod], [30, 20]], "B");
    c.poly([[34, 25 + nod], [38.5, 30.5 + nod], [37, 33], [33, 29 + nod]], "B");
    c.line(26, 11, 33, 22, "M", 2.2);
    c.dot(35.2, 27 + nod, "K");
  } else {
    c.poly([[25.5, 12.5], [29, 5.5], [33.5, 3.5], [36, 7.5], [32, 16]], "B");
    c.poly([[31.5, 3.2], [35, 1.8], [40.5, 7.2], [41, 10.2], [38.4, 10.8], [33.5, 7]], "B");
    c.poly([[32.4, 2.8], [33, 0.4], [34.2, 2.4]], "B");
    c.line(32.5, 2.5, 26.5, 11, "M", 2.2);
    c.dot(35.4, 5.2, "K").dot(40, 9.4, "k");
  }
  // しっぽ（草を食む2コマ目はゆらす）
  const swish = pose === "graze1" ? 1.4 : 0;
  c.line(8.8, 12.5, 5, 17, "M", 2.6).line(5, 17, 4.2 - swish, 23, "M", 2.2);
  legPair(legs.nf, "B");
  legPair(legs.nb, "B");
  return c.rows();
}

const horse = () => shadedSprite(
  1.3,
  {
    o: "#24140a",
    b: "#7a3f1c",
    B: "#a2572a",
    c: "#c47540",
    d: "#5e2f14",
    D: "#7e4220",
    f: "#955430",
    M: "#2a1a12",
    n: "#1a0e08",
    N: "#3e2a20",
    m: "#2e1e16",
    H: "#1a120e",
    K: "#0e0806",
    k: "#1e120c",
  },
  { shade: { B: "bBc", D: "dDf", M: "nMN" }, outline: "o" },
  { run0: horseFrame("run0"), run1: horseFrame("run1"), run2: horseFrame("run2"), graze0: horseFrame("graze0"), graze1: horseFrame("graze1") },
);

// ---- イルカ（バンドウイルカ。丸いおでこと短いくちばし。尾を上下に） ----

function dolphinFrame(up: boolean): string[] {
  const c = pixelCanvas(39, 17);
  c.poly(
    [[5, 9], [9, 7.2], [14, 5.4], [20, 4.4], [26, 4.8], [30, 5.6], [32.5, 6.6], [33.8, 7.8], [34.2, 8.4], [37.6, 8.6], [37.8, 9.6], [34, 10.4], [30, 11.2], [24, 12.4], [17, 12.6], [11, 11.6], [7, 10.4]],
    "B",
  );
  c.ellipse(30.6, 7.8, 3.2, 2.9, "B");
  c.poly([[23.5, 4.8], [21.5, 2.2], [19, 0.8], [18.2, 1.2], [19.6, 2.8], [18.6, 4.8]], "B");
  c.poly([[25, 11.4], [23, 14.8], [24.4, 15], [27, 11.8]], "B");
  const tilt = up ? -1.6 : 1.6;
  c.poly([[5.5, 9.2], [1, 5.5 + tilt], [2.6, 5.2 + tilt], [6.5, 8.6]], "B").poly([[5.5, 9.6], [1, 13.5 + tilt], [2.6, 13.8 + tilt], [6.5, 10.2]], "B");
  c.poly([[10, 10.8], [18, 11.8], [26, 11.4], [33.5, 9.8], [37.5, 9.4], [34, 10.6], [26, 12.6], [18, 12.8], [11, 11.8]], "C", "B");
  c.line(33.8, 9.2, 37.2, 9.1, "m", 1);
  c.dot(31.4, 7.8, "K");
  return c.rows();
}

const dolphin = () => shadedSprite(
  1.4,
  { o: "#1e3040", b: "#4e6e88", B: "#6e90ac", c: "#94b4cc", C: "#dce8f0", v: "#b8ccd8", u: "#f4f8fb", m: "#2e4658", K: "#101a24" },
  { shade: { B: "bBc", C: "vCu" }, outline: "o" },
  { swim0: dolphinFrame(true), swim1: dolphinFrame(false) },
);

// ---- きつね（アカギツネ）とたぬき ----

function foxFrame(pose: "walk0" | "walk1" | "walk2" | "sit"): string[] {
  const c = pixelCanvas(37, 23);
  const ground = 21.6;
  const leg = (x0: number, x1: number, region: string) => {
    c.line(x0, 13, x1, ground - 0.8, region, 1.8);
    c.line(x0 + (x1 - x0) * 0.55, 13 + (ground - 13) * 0.55, x1, ground - 0.8, "K", 1.8);
    c.ellipse(x1 + 0.5, ground - 0.5, 1.2, 0.7, "K");
  };
  if (pose === "sit") {
    // 座って、しっぽを前足のところまで巻く
    c.ellipse(17, 17, 5.6, 4.6, "B");
    c.poly([[15, 20], [16, 12], [20, 8.2], [24, 9], [26, 13], [25.4, 21]], "B");
    c.poly([[12.5, 17], [10.6, 20.4], [14, 22], [24, 22], [30.4, 21.6], [30.8, 19.8], [26, 19.6], [16, 19.4]], "B");
    c.ellipse(30, 20.8, 1.7, 1.2, "W");
    c.poly([[21, 9.5], [24, 5], [27.5, 5.5], [26, 11]], "B");
    c.ellipse(26.5, 5.8, 3.2, 2.8, "B").poly([[27.5, 5.2], [32.5, 7], [28, 8.6]], "B");
    c.poly([[24.4, 4], [24.8, 0.4], [26.8, 3.4]], "B").poly([[26.9, 3.2], [28.8, 0.6], [29, 4.4]], "B");
    c.ellipse(28.5, 7.6, 2.4, 1.2, "W", "B").ellipse(24.2, 13, 2, 3.6, "W", "B");
    c.line(23, 14, 23, ground - 1.2, "K", 1.8).line(25.2, 14, 25.6, ground - 1.2, "K", 1.8);
    c.dot(27.6, 5.2, "E").dot(32.4, 7, "k");
    return c.rows();
  }
  const phase = pose === "walk1" ? 1 : pose === "walk2" ? 2 : 0;
  leg(9, [7, 9, 11][phase]!, "D");
  leg(22, [24, 22, 20][phase]!, "D");
  c.poly([[8, 9.5], [3, 10.5], [0.8, 13.5], [1.5, 16], [5, 15], [8.5, 12.5]], "B");
  c.ellipse(1.8, 15, 1.6, 1.3, "W");
  c.ellipse(14.5, 10.8, 8.4, 3.7, "B");
  c.ellipse(22, 10.6, 3.4, 3.8, "B");
  c.poly([[22, 8], [25, 5], [27, 9], [24.5, 12.5]], "B");
  c.ellipse(27, 6.6, 3.2, 2.8, "B").poly([[28, 6], [33.6, 7.8], [28.6, 9.4]], "B");
  c.poly([[25.2, 4.6], [25.6, 0.6], [27.6, 4.2]], "B").poly([[27.8, 4], [29.6, 1], [29.8, 5.2]], "B");
  c.ellipse(29, 8.5, 2.6, 1.2, "W", "B").ellipse(23.6, 12.2, 2, 2.2, "W", "B");
  leg(11, [13, 11, 9][phase]!, "B");
  leg(24, [22, 24, 26][phase]!, "B");
  c.dot(28.2, 6, "E").dot(33.4, 7.8, "k");
  return c.rows();
}

const fox = () => shadedSprite(
  1.4,
  {
    o: "#3a1a0c",
    b: "#b8561e",
    B: "#e07a32",
    c: "#f39c52",
    d: "#9a4818",
    D: "#bf6428",
    f: "#d8864a",
    W: "#fbf6ee",
    v: "#ddd2c2",
    u: "#ffffff",
    K: "#241612",
    E: "#1a0e08",
    k: "#1a0e08",
  },
  { shade: { B: "bBc", D: "dDf", W: "vWu" }, outline: "o" },
  { walk0: foxFrame("walk0"), walk1: foxFrame("walk1"), walk2: foxFrame("walk2"), sit: foxFrame("sit") },
);

function tanukiFrame(pose: "walk0" | "walk1" | "walk2" | "sit"): string[] {
  const c = pixelCanvas(33, 21);
  const ground = 19.6;
  const leg = (x0: number, x1: number) => {
    c.line(x0, 13, x1, ground - 0.8, "K", 2);
    c.ellipse(x1 + 0.4, ground - 0.5, 1.3, 0.7, "K");
  };
  if (pose === "sit") {
    c.ellipse(15.5, 13, 6, 6.3, "B");
    c.poly([[10, 17], [4.5, 17.5], [2.8, 15], [5, 14], [10, 14]], "B").ellipse(3.4, 16.3, 1.6, 1.4, "K");
    c.ellipse(20.5, 7, 3.8, 3.4, "B");
    c.ellipse(18.6, 4, 1.2, 1.1, "K").ellipse(22.6, 4, 1.2, 1.1, "K");
    c.ellipse(20.5, 8.8, 2.4, 1.6, "C").dot(20.5, 8.2, "k");
    c.ellipse(18.9, 7, 1.3, 0.9, "K").ellipse(22.1, 7, 1.3, 0.9, "K").dot(18.9, 6.8, "W").dot(22.1, 6.8, "W");
    c.ellipse(17.5, 14.5, 3, 4, "C", "B");
    leg(15, 15);
    leg(19, 19.4);
    for (const [x, y] of [[12, 9], [14, 8], [11, 12], [13, 11]] as P[]) c.dot(x, y, "d");
    return c.rows();
  }
  const phase = pose === "walk1" ? 1 : pose === "walk2" ? 2 : 0;
  leg(9, [7.5, 9, 10.5][phase]!);
  leg(20, [21.5, 20, 18.5][phase]!);
  c.poly([[7, 9.5], [3, 10.5], [1, 13.5], [2.4, 15], [6, 13.5], [8, 12]], "B").ellipse(1.8, 14, 1.5, 1.2, "K");
  c.ellipse(14, 10.5, 8.6, 5, "B");
  c.ellipse(24.5, 8.3, 3.7, 3.3, "B");
  c.poly([[26, 7.8], [30.4, 9], [26.6, 10.8]], "C");
  c.ellipse(22.6, 5.2, 1.2, 1.1, "K").ellipse(25.2, 5, 1.1, 1, "K");
  c.ellipse(25.6, 8, 1.8, 1.1, "K").dot(26, 7.7, "W");
  c.dot(30.2, 9, "k");
  c.ellipse(16, 13.8, 5.5, 1.5, "C", "B");
  leg(11, [12.5, 11, 9.5][phase]!);
  leg(22, [20.5, 22, 23.5][phase]!);
  for (const [x, y] of [[10, 7], [13, 6.5], [16, 7], [19, 7.5], [12, 9], [17, 9]] as P[]) c.dot(x, y, "d");
  return c.rows();
}

const tanuki = () => shadedSprite(
  1.4,
  { o: "#20160e", b: "#6e5a46", B: "#8e785f", c: "#ab9678", C: "#e2d6c0", K: "#2a2019", W: "#f4efe6", k: "#1a120c", d: "#5a4838" },
  { shade: { B: "bBc" }, outline: "o" },
  { walk0: tanukiFrame("walk0"), walk1: tanukiFrame("walk1"), walk2: tanukiFrame("walk2"), sit: tanukiFrame("sit") },
);

/** critter-sprites-real.ts の realSprites() から、最初に使うときに作る */
export function moreRealSprites() {
  return {
    squirrel: squirrel(),
    goldfish: goldfish(),
    dog: dog(),
    hamster: hamster(),
    horse: horse(),
    dolphin: dolphin(),
    fox: fox(),
    tanuki: tanuki(),
  };
}
