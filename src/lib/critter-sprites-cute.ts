/**
 * 待ち時間の動物の「かわいい」絵（カードの上や間を歩く）。1文字 = 1ドット、"." は透明。
 * コマの名前は動き（critter-moves.ts）から呼ぶ。同じ動物のコマはどれも同じ大きさにする
 */
import type { Sprite } from "@/lib/critter-sprite";
import { MORE_CUTE_SPRITES } from "@/lib/critter-sprites-cute-more";

// ---- カエル（正面。座っているときは2行下げて、跳んだとき脚が伸びる） ----

const FROG_FACE = [
  "..DDD....DDD..",
  ".DWWWD..DWWWD.",
  ".DWKWDDDDWKWD.",
  "DGGGGGGGGGGGGD",
  "DGppGGGGGGppGD",
  "DGGGGDGGDGGGGD",
  ".DGGGGDDGGGGD.",
];

const FROG_BLINK_FACE = ["..DDD....DDD..", ".DGGGD..DGGGD.", ".DKKKDDDDKKKD.", ...FROG_FACE.slice(3)];

const FROG_SIT_BODY = [".DGGLLLLLLGGD.", "DGGDLLLLLLDGGD", "DGGDDLLLLDDGGD", ".DDD.DDDD.DDD."];

const FROG_JUMP_BODY = [
  "..DGLLLLLLGD..",
  "..DGLLLLLLGD..",
  "..DDLLLLLLDD..",
  ".DGD.DDDD.DGD.",
  "DGD........DGD",
  "DD..........DD",
];

const EMPTY14 = "..............";

const FROG: Sprite = {
  px: 2.25,
  palette: { D: "#2f5b33", G: "#72c450", L: "#dcf3a8", W: "#ffffff", K: "#1c1c1c", p: "#f59caa" },
  frames: {
    sit: [EMPTY14, EMPTY14, ...FROG_FACE, ...FROG_SIT_BODY],
    blink: [EMPTY14, EMPTY14, ...FROG_BLINK_FACE, ...FROG_SIT_BODY],
    jump: [...FROG_FACE, ...FROG_JUMP_BODY],
  },
};

// ---- ペンギン（横向き・正面・後ろ姿を足の2コマで。横に歩くときはたまにお腹で滑る） ----

const PENGUIN_SIDE = [
  "....KKKK....",
  "...KKKKKK...",
  "..KKKKKKKK..",
  "..KKKKKWEK..",
  "..KKKKKKKOOO",
  "..KKKKKWpWK.",
  ".KKKKKWWWWWK",
  ".KKkKKWWWWWK",
  "KKkkKKWWWWWK",
  "KKkkKKWWWWWK",
  ".KkKKKWWWWK.",
  "..KKKKWWWK..",
  "...KKKKKK...",
];

const PENGUIN_FRONT = [
  "....KKKK....",
  "...KKKKKK...",
  "..KKKKKKKK..",
  "..KWEWWEWK..",
  "..KWWOOWWK..",
  ".KKpWWWWpKK.",
  ".KKWWWWWWKK.",
  "KkKWWWWWWKkK",
  "KkKWWWWWWKkK",
  "KkKWWWWWWKkK",
  ".KKWWWWWWKK.",
  "..KKWWWWKK..",
  "...KKKKKK...",
];

const PENGUIN_BACK = [
  "....KKKK....",
  "...KkkKKK...",
  "..KKkKKKKK..",
  "..KKKKKKKK..",
  "..KKKKKKKK..",
  ".KKKKKKKKKK.",
  ".KKKKKKKKKK.",
  "KkKKKKKKKKkK",
  "KkKKKKKKKKkK",
  "KkKKKKKKKKkK",
  ".KKKKKKKKKK.",
  "..KKKKKKKK..",
  "...KKKKKK...",
];

const EMPTY12 = "............";

const PENGUIN: Sprite = {
  px: 2.25,
  palette: { K: "#26344a", k: "#3d5170", W: "#fbfbf6", E: "#141414", O: "#f4a236", p: "#f7a3b2" },
  frames: {
    side0: [...PENGUIN_SIDE, "....OOOO...."],
    side1: [...PENGUIN_SIDE, "..OO....OO.."],
    front0: [...PENGUIN_FRONT, "..OOO...OO.."],
    front1: [...PENGUIN_FRONT, "..OO...OOO.."],
    back0: [...PENGUIN_BACK, "..OOO...OO.."],
    back1: [...PENGUIN_BACK, "..OO...OOO.."],
    slide: [
      ...Array.from({ length: 8 }, () => EMPTY12),
      "....KKKKK...",
      "..KKKKKKKKK.",
      ".KkKKKKKKWEK",
      "OKkkKKKKKKKO",
      "OKWWWWWWWpK.",
      "..WWWWWWWW..",
    ],
  },
};

// ---- うさぎ（横向き。止まると前の耳がぴくっ） ----

const RABBIT_EARS = [
  "......oo.oo.....",
  ".....oWpoWpo....",
  ".....oWpoWpo....",
  "......oWpoWpo...",
  "......oWpoWpo...",
];

const RABBIT_EARS_TWITCH = [
  "......oo..oo....",
  ".....oWpo.oWpo..",
  ".....oWpooWpo...",
  "......oWpoWpo...",
  "......oWpoWpo...",
];

const RABBIT_HEAD = [
  "....ooWWWWWWWoo.",
  "...oWWWWWWWWWWWo",
  "...oWWWWWWWWKWWo",
  "..oWWWWWWWWWKWWn",
  ".oWWWWWWWWWWWppo",
];

const RABBIT_SIT = [
  "oWoWWWWWWWWWWWo.",
  "oWWWWWWWWWWWWo..",
  ".oWWWWWWWWWWWWo.",
  "..oWWWWWWWoWWWo.",
  "..oWWWWWWoWWWWo.",
  "...oooooooooooo.",
];

const RABBIT_HOP = [
  "oWoWWWWWWWWWWWo.",
  "oWWWWWWWWWWWWWo.",
  ".oWWWWWWWWWWWWWo",
  "..ooWWWWWWWWoWWo",
  ".oWWoooooooooo..",
  "oWWo............",
];

const RABBIT: Sprite = {
  px: 2.1,
  palette: { o: "#8c7373", W: "#ffffff", p: "#f7aebf", K: "#3b2b2e", n: "#ef8aa0" },
  frames: {
    sit: [...RABBIT_EARS, ...RABBIT_HEAD, ...RABBIT_SIT],
    ear: [...RABBIT_EARS_TWITCH, ...RABBIT_HEAD, ...RABBIT_SIT],
    hop: [...RABBIT_EARS, ...RABBIT_HEAD, ...RABBIT_HOP],
  },
};

// ---- 蝶々（上から見て、羽を開く → 半分 → 閉じる） ----

const BUTTERFLY_FEELERS = ["...k.....k...", "....k...k...."];

const BUTTERFLY: Sprite = {
  px: 2.1,
  palette: { k: "#3a2e3a", o: "#b0582a", Y: "#ffc23d", O: "#ff8f3a", w: "#fff6dc" },
  frames: {
    open: [
      ...BUTTERFLY_FEELERS,
      ".ooo..k..ooo.",
      "oYYYo.k.oYYYo",
      "oYwYYokoYYwYo",
      "oYYYYokoYYYYo",
      ".oYYYokoYYYo.",
      "..oooOkOooo..",
      ".oOOOOkOOOOo.",
      ".oOwOokoOwOo.",
      "..oOo.k.oOo..",
      "...o.....o...",
    ],
    mid: [
      ...BUTTERFLY_FEELERS,
      "...oo.k.oo...",
      "..oYYokoYYo..",
      "..owYokoYwo..",
      "..oYYokoYYo..",
      "...oYokoYo...",
      "...ooOkOoo...",
      "...oOOkOOo...",
      "...owOkOwo...",
      "....ookoo....",
      ".............",
    ],
    shut: [
      ...BUTTERFLY_FEELERS,
      "....ookoo....",
      "....oYkYo....",
      "....oYkYo....",
      "....oYkYo....",
      "....oYkYo....",
      "....oOkOo....",
      "....oOkOo....",
      "....oOkOo....",
      ".....oko.....",
      ".............",
    ],
  },
};

// ---- ひよこの行列（親鳥と、後ろをついて歩くひよこ） ----

const HEN_TOP = [
  "..........rr....",
  ".........rrrr...",
  ".........oWWWo..",
  "........oWWKWWo.",
  "........oWWWpWyy",
  "..oo....oWWWWWr.",
  ".oWWo...oWWWWo..",
  ".oWWWoooWWWWWo..",
  ".oWWWWWWWWWWWWo.",
  "..oWWWwwwWWWWWo.",
  "..oWWWWwwwWWWWo.",
  "...oWWWWWWWWWo..",
  "....ooooooooo...",
];

const HEN: Sprite = {
  px: 2.1,
  palette: { o: "#7d6a5c", W: "#ffffff", w: "#e6ded4", r: "#e8453c", y: "#f6b73c", K: "#2e2622", p: "#f7aebf" },
  frames: {
    walk0: [...HEN_TOP, ".......y..y.....", ".......yy.yy...."],
    walk1: [...HEN_TOP, "........y.y.....", "........yyyy...."],
    peck: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "..oo............",
      ".oWWo...........",
      ".oWWWoooooo.....",
      ".oWWWWWWWWWWo.rr",
      "..oWWWwwwWWWorrr",
      "..oWWWWwwwWWoWWo",
      "...oWWWWWWWoWKWo",
      "....oooooooooWpy",
      ".......y..y..ooy",
      ".......yy.yy....",
    ],
  },
};

const CHICK_BODY = [
  "...oooo..",
  "..oYYYYo.",
  ".oYYYYKYo",
  ".oYYYYpOO",
  "oYYyYYYYo",
  "oYyyYYYYo",
  ".oYYYYYo.",
];

const CHICK: Sprite = {
  px: 2.1,
  palette: { o: "#b8862a", Y: "#ffe066", y: "#f5c542", K: "#2e2622", O: "#f08a24", p: "#f7a8a0" },
  frames: {
    walk0: [...CHICK_BODY, "..OoooO.."],
    walk1: [...CHICK_BODY, "...OooOO."],
    peep: [...CHICK_BODY.slice(0, 2), ".oYYYYKOO", ".oYYYYpO.", ...CHICK_BODY.slice(4), "..OoooO.."],
  },
};

// ---- 小鳥（中心のカードでさえずり、語が届くと飛び立つ） ----

const BIRD_SIT = [
  ".....oooo...",
  "....oBBBBo..",
  "...oBBBBKBo.",
  "...oBBBBBpOO",
  "..oBBBBBCCo.",
  ".oBBbbBCCCo.",
  "oBBbbbBCCCo.",
  "ooobbbBCCCo.",
  "....oBBCCo..",
  ".....oooo...",
  "......O.O...",
];

const BIRD: Sprite = {
  px: 2.1,
  palette: { o: "#35517a", B: "#6aa8e8", b: "#4a86c8", C: "#fff6e0", K: "#1e2430", O: "#f2a33a", p: "#f7aebf" },
  frames: {
    sit: BIRD_SIT,
    chirp: [...BIRD_SIT.slice(0, 2), "...oBBBBKBOO", "...oBBBBBpo.", "..oBBBBBCCoO", ...BIRD_SIT.slice(5)],
    fly0: [
      "oo...oooo...",
      "obo.oBBBBo..",
      "obboBBBBKBo.",
      ".obbBBBBBpOO",
      "..obBBBBCCo.",
      ".oBBBBBCCCo.",
      "oBBBBBBCCCo.",
      "oooBBBBCCCo.",
      "....oBBCCo..",
      ".....oooo...",
      "............",
    ],
    fly1: [
      ".....oooo...",
      "....oBBBBo..",
      "...oBBBBKBo.",
      "...oBBBBBpOO",
      "..oBBBBBCCo.",
      ".oBBBBBCCCo.",
      "oBBoobBCCCo.",
      "oooobbbCCCo.",
      "...obbbCCo..",
      "...obbooo...",
      "....oo......",
    ],
  },
};

// ---- リス（空のカードへどんぐりを置いていく） ----

const SQUIRREL_SIT = [
  "..oooo..........",
  ".oTTTTo.........",
  "oTTttTTo..o..o..",
  "oTtooTTo.oTooTo.",
  "oTto.oTooTTTTTo.",
  "oTto..ooTTTTKTTo",
  "oTTo..oTTTTTTTTn",
  ".oTTooTTTTTpCTo.",
  "..oTTTTTTTCCCo..",
  "..oTTTTTTCCCCo..",
  "..oTTTTTTCCCCo..",
  "..oTTTTTTCCCo...",
  "...oTTTTTTCCo...",
  "....oTTTTTTTo...",
  "....oooooooooo..",
];

const SQUIRREL_RUN_TOP = [
  "................",
  "................",
  "................",
  ".ooo............",
  "oTTTo...........",
  "oTtTTo......o...",
  "oTttTo.....oTo..",
  ".oTtTToooooTTTo.",
  "..oTTTTTTTTTKTo.",
  "..oTTTTTTTTTTTTn",
  "...oTTTTTTTCCCo.",
  "....oTTTTTCCCo..",
];

const SQUIRREL: Sprite = {
  px: 2.1,
  palette: {
    o: "#6b3f24",
    T: "#d9803a",
    t: "#f2ad6a",
    C: "#fbe6c6",
    K: "#2a1a14",
    n: "#5a3020",
    p: "#f5a0a0",
    A: "#c98a4a",
    a: "#7a4a24",
  },
  frames: {
    sit: SQUIRREL_SIT,
    nibble0: [...SQUIRREL_SIT.slice(0, 7), ".oTTooTTTTTpCaa.", "..oTTTTTTTCCTAAo", "..oTTTTTTCCCToAo", ...SQUIRREL_SIT.slice(10)],
    nibble1: [
      ...SQUIRREL_SIT.slice(0, 6),
      "oTTo..oTTTTTTTaa",
      ".oTTooTTTTTpCTAA",
      "..oTTTTTTTCCCoAo",
      ...SQUIRREL_SIT.slice(9),
    ],
    run0: [...SQUIRREL_RUN_TOP, "....oTooooTTo...", "...oTo....oTo...", "...oo......oo..."],
    run1: [...SQUIRREL_RUN_TOP, ".....oTooTTo....", ".....oTTTTo.....", "......oooo......"],
  },
};

/** リスが空のカードに置くどんぐり */
const ACORN: Sprite = {
  px: 2.1,
  palette: { a: "#7a4a24", A: "#c98a4a", h: "#e8b27a", o: "#5a3418" },
  frames: { acorn: ["..a..", ".aaa.", "aaaaa", "oAhAo", "oAAAo", ".oAo."] },
};

export const CUTE_SPRITES = {
  frog: FROG,
  penguin: PENGUIN,
  rabbit: RABBIT,
  butterfly: BUTTERFLY,
  hen: HEN,
  chick: CHICK,
  bird: BIRD,
  squirrel: SQUIRREL,
  acorn: ACORN,
  ...MORE_CUTE_SPRITES,
} satisfies Record<string, Sprite>;
