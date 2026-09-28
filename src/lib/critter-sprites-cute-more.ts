/**
 * 待ち時間の動物の「かわいい」絵のつづき（金魚・ねこ・いぬ・ハムスター・うま・イルカ・きつねとたぬき）と、飛ばす小物。
 * 描き方は critter-sprites-cute.ts と同じ（1文字 = 1ドット、"." は透明）
 */
import type { Sprite } from "@/lib/critter-sprite";

// ---- 金魚（上から見て。溝を水路に見立てて泳ぐ。進む向きに回して使う） ----

const GOLDFISH: Sprite = {
  px: 2.1,
  palette: { o: "#b8321e", R: "#ff6a3d", D: "#e84a2a", r: "#ffb49a", K: "#2a1a18", w: "#ffe2d2" },
  frames: {
    swim0: [
      ".ooo..........",
      "orrro...oooo..",
      ".orrrooRRRRRo.",
      "..orRRRRRRwRKo",
      "...oRDDDDDRRRo",
      "..orRRRRRRwRKo",
      ".orrrooRRRRRo.",
      "orrro...oooo..",
      ".ooo..........",
    ],
    swim1: [
      "..............",
      ".oo.....oooo..",
      "orrooooRRRRRo.",
      ".orrRRRRRRwRKo",
      "..orDDDDDDRRRo",
      ".orrRRRRRRwRKo",
      "orrooooRRRRRo.",
      ".oo.....oooo..",
      "..............",
    ],
  },
};

// ---- ねこ（カードの上で丸くなって寝る。三毛） ----

const CAT_HEAD = [
  "...........o....o.",
  "..........oOo..oko",
  ".oo.......oOWWWWko",
  "oWo.......oWKWWKWo",
  "oOo.......obWppWbo",
];

const CAT_BODY = [
  ".oOo.ooooooWWWWWo.",
  "..oOoWWWOOOWWWWo..",
  "...oWWWOOOOWWWWo..",
  "...oWWWWOOWWWWWo..",
  "...oWWWWWWWWWWWo..",
];

const CAT_SIT_TOP = [
  "...........o....o.",
  "..........oOo..oko",
  "..........oOWWWWko",
  "..........oWKWWKWo",
  "..........obWppWbo",
];

const CAT_SLEEP = [
  "..................",
  "..................",
  "..................",
  "..................",
  "...........o....o.",
  "..........oOo..oko",
  "....ooooooOOWWWWko",
  "...oWWOOOoWWWWWWWo",
  "..oWWOOOOoWKKWKKWo",
  "..oWWWOOWWWWWppWWo",
  "..oOOWWWWWWWWWWWo.",
  "...ooooooooooooo..",
];

const CAT: Sprite = {
  px: 2,
  palette: { o: "#5b5050", W: "#ffffff", O: "#f5a04a", k: "#3a3434", K: "#2a2424", p: "#f5a0b0", b: "#ffc6d0" },
  frames: {
    walk0: [...CAT_HEAD, ...CAT_BODY, "...oWWoooooooWWo..", "...oWo.......oWo.."],
    walk1: [...CAT_HEAD, ...CAT_BODY, "...oWWoooooooWWo..", "..oWo.........oWo."],
    sit: [
      ...CAT_SIT_TOP,
      "..........ooWWWWo.",
      ".........oWWOOOWo.",
      "........oWWOOOOWo.",
      "..oo....oWWWOOWWo.",
      ".oOo....oWWWWWWWo.",
      ".oOoooooOWWWoWWWo.",
      "..oOOOOOoooooooo..",
    ],
    sleep0: CAT_SLEEP,
    sleep1: [...CAT_SLEEP.slice(0, 5), "....oooooooOo..oko", "...oWWOOOoOOWWWWko", ...CAT_SLEEP.slice(7)],
  },
};

// ---- いぬ（柴犬。溝を走り回り、座ってしっぽを振る） ----

const DOG_TOP = [
  "...........o....o.",
  "..ooo.....oSo..oSo",
  ".oSSSo....oSSSSSSo",
  ".oSCoSo...oSKSSKSo",
  ".oSooSo...opCKKCpo",
  "..oSSSooooooCCCCo.",
  "...oSSSSSSSSoooo..",
  "...oSSSSSSSSSSSo..",
  "...oSSSSSSSSCCCo..",
  "...oSSSSSSSCCCCo..",
];

const DOG_SIT_HEAD = [
  "...........o....o.",
  "..........oSo..oSo",
  "..........oSSSSSSo",
  "..........oSKSSKSo",
  "..........opCKKCpo",
];

const DOG_SIT_BODY = [
  "......oSSSSSCCCo..",
  "......oSSSSSCCCo..",
  ".....oSSSSSoSSCo..",
  ".....oSSSSSoSSCo..",
  ".....ooooooooooo..",
];

const DOG: Sprite = {
  px: 2,
  palette: { o: "#6b4020", S: "#e9a352", C: "#fff1dc", K: "#2a2020", p: "#f5a0a0" },
  frames: {
    walk0: [...DOG_TOP, "....oSSooooSSCo...", "....oSo....oSo....", "....oSo....oSo....", "....oo.....oo....."],
    walk1: [...DOG_TOP, "....oSSooooSSCo...", "...oSo......oSo...", "...oSo......oSo...", "...oo.......oo...."],
    sit0: [
      ...DOG_SIT_HEAD,
      "......ooo.ooCCCCo.",
      ".....oSSSooSoooo..",
      ".....oSCoSSSSCCo..",
      ".....oSooSSSCCCo..",
      ...DOG_SIT_BODY,
    ],
    sit1: [
      ...DOG_SIT_HEAD,
      ".....ooo..ooCCCCo.",
      "....oSSSo.oSoooo..",
      "....oSCoSSSSSCCo..",
      "....oSoooSSSCCCo..",
      ...DOG_SIT_BODY,
    ],
  },
};

// ---- ハムスター（ちょこまか走り、止まるとほお袋をもぐもぐ） ----

const HAMSTER_FACE = [
  "..oo....oo..",
  ".oppo..oppo.",
  ".oHHooooHHo.",
  "oHHHHHHHHHHo",
  "oHKHHHHHHKHo",
  "oHHHHnnHHHHo",
];

const HAMSTER_RUN_TOP = [
  "............",
  "............",
  "............",
  "............",
  ".....oo.o...",
  "...ooHHoHo..",
  "..oHHHHHHHo.",
  ".oHHHHHHHKHo",
  ".oHHHHHHHHHn",
  ".oWWWHHHHWWo",
  "..oWWWWWWWo.",
];

const HAMSTER: Sprite = {
  px: 2.1,
  palette: { o: "#8a5a30", H: "#f5b860", W: "#ffffff", K: "#2a2020", p: "#f7a8b0", n: "#e07a8a" },
  frames: {
    sit: [...HAMSTER_FACE, "oWpWWWWWWpWo", "oWWWWWWWWWWo", "oHWWWWWWWWHo", "oHHWWWWWWHHo", ".oHHWWWWHHo.", "..oooooooo.."],
    munch0: [...HAMSTER_FACE, "oWWWWWWWWWWo", "oWWWWppWWWWo", "oHWWWWWWWWHo", "oHHWWWWWWHHo", ".oHHWWWWHHo.", "..oooooooo.."],
    munch1: [...HAMSTER_FACE, "oWpWWppWWpWo", "oWWWWWWWWWWo", "oHWWWWWWWWHo", "oHHWWWWWWHHo", ".oHHWWWWHHo.", "..oooooooo.."],
    run0: [...HAMSTER_RUN_TOP, "..oo.o.o.oo."],
    run1: [...HAMSTER_RUN_TOP, "...oo.o.oo.."],
  },
};

// ---- うま（3×3 の外周を走る） ----

const HORSE_TOP = [
  "................o.o...",
  "...............oBoBo..",
  "..............omBBBBo.",
  ".............ommBBKBBo",
  ".............omBBBBBBo",
  "............ommBBBBnno",
  "............omBBBBnnno",
  "..ooo......ommBBBooooo",
  ".ommmo....ommBBBBo....",
  "ommmmmooooBBBBBBBo....",
  "ommo.oBBBBBBBBBBBo....",
  "omo..oBBBBBBBBBBBo....",
  "omo..oBBBBBBBBBBBo....",
  ".o...oBBBBBBBBBBo.....",
];

const HORSE: Sprite = {
  px: 1.9,
  palette: { o: "#4a2e1e", B: "#c47f45", m: "#5a3624", W: "#fff4e6", K: "#2a1a14", n: "#e8b890" },
  frames: {
    stand: [...HORSE_TOP, "......oBooooooBBo.....", "......oBo....oBo......", "......oWo....oWo......", "......ooo....ooo......"],
    run0: [...HORSE_TOP, ".....oBBooooooBBo.....", "....oBo........oBo....", "...oWo..........oWo...", "...oo............oo..."],
    run1: [...HORSE_TOP, "......oBooooooBBo.....", ".......oBo..oBo.......", ".......oWo..oWo.......", ".......ooo..ooo......."],
  },
};

// ---- イルカ（溝の水から跳ねて、カードを越える。水の中では背びれだけ） ----

const DOLPHIN: Sprite = {
  px: 1.9,
  palette: { o: "#2a4a6a", D: "#62a3db", L: "#e8f4fc", K: "#1a2a3a", p: "#f5b0c0" },
  frames: {
    // 水の外に出ているのは跳ねている間だけなので1コマ（弧に合わせて回す）
    leap: [
      "......................",
      "........oo............",
      ".........oDo..........",
      "oo.....oooDDoooooo....",
      "oDo..ooDDDDDDDDDDDo...",
      ".oDooDDDDDDDDDDDDKDo..",
      "..oDDDDDDDDDDDDDDDDDoo",
      ".oDoLLLLLLLLLLLLLpLDDo",
      "oDo.ooLLLLLLLLLLLLooo.",
      "oo....oooooooooooo....",
    ],
  },
};

/** 水の中を進むイルカの背びれと、まわりのさざ波 */
const DOLPHIN_FIN: Sprite = {
  px: 1.9,
  palette: { o: "#2a4a6a", D: "#62a3db", w: "#bfe3ff" },
  frames: {
    fin0: ["...oo...", "..oDDo..", ".oDDDo..", "oDDDDDo.", "w.ww.ww."],
    fin1: ["...oo...", "..oDDo..", ".oDDDo..", "oDDDDDo.", ".ww.ww.w"],
  },
};

// ---- きつねとたぬき（きつねが先を歩き、たぬきがついていく。止まるとたぬきが腹つづみ） ----

const FOX_TOP = [
  "..........o......o",
  ".ooo......oko..oko",
  "oWWWo.....oFFFFFFo",
  "oWFFFo....oFKFFKFo",
  "oFFFFFo...opWWWWpo",
  ".oFFFFFooooWWkkWo.",
  "..oFFFFFFFFFoooo..",
  "...oFFFFFFFFFFFo..",
  "...ooFFFFFFFWWWo..",
  "....oFFFFFFWWWWo..",
];

const FOX: Sprite = {
  px: 2,
  palette: { o: "#7a3a18", F: "#f08a3a", W: "#ffffff", k: "#3a2a24", K: "#2a1a14", p: "#f5a0a0" },
  frames: {
    walk0: [...FOX_TOP, "....okkooookkWo...", "....oko....oko....", "....oko....oko....", "....oo.....oo....."],
    walk1: [...FOX_TOP, "....okkooookkWo...", "...oko......oko...", "...oko......oko...", "...oo.......oo...."],
    sit: [
      "..........o......o",
      "..........oko..oko",
      "..........oFFFFFFo",
      "..........oFKFFKFo",
      "..........opWWWWpo",
      "..........oWWkkWo.",
      ".........oFoooooo.",
      "........oFFFWWWo..",
      "........oFFFWWWo..",
      ".......oFFFFWWWo..",
      "..oooo.oFFFFFWWo..",
      ".oWWFFooFFFFkoko..",
      ".oWWFFFFFFFFkoko..",
      "..oooooooooooooo..",
    ],
  },
};

const TANUKI_TOP = [
  "..........oo..oo",
  "..........oMooMo",
  ".ooo.....oTTTTTo",
  "oTTTo....oMWTMWo",
  "oMMTTo...oMMCMMo",
  "oTTTTTooooCCnCo.",
  ".oMMTTTTTTToooo.",
  "..oTTTTTTTTTTTo.",
  "..oTTTTTTTCCCCo.",
  "..oTTTTTTCCCCCo.",
];

const TANUKI_FRONT = [
  "...oo......oo...",
  "..oMMo....oMMo..",
  "..oMTTooooTTMo..",
  "..oTTTTTTTTTTo..",
  ".oMMWMTTTTMWMMo.",
  ".oMMMMTTTTMMMMo.",
  ".oTTCCCnnCCCTTo.",
  "..oTTCCCCCCTTo..",
];

const TANUKI: Sprite = {
  px: 2,
  palette: { o: "#4a3a2e", T: "#a98c6c", M: "#4e3e32", C: "#f1e3cc", W: "#ffffff", k: "#3a2e26", n: "#2a201a" },
  frames: {
    walk0: [...TANUKI_TOP, "...okkooookkCo..", "...oko....oko...", "...oko....oko...", "...oo.....oo...."],
    walk1: [...TANUKI_TOP, "...okkooookkCo..", "..oko......oko..", "..oko......oko..", "..oo.......oo..."],
    sit: [
      ...TANUKI_FRONT,
      "..okTTTTTTTTko..",
      ".okkTCCCCCCTkko.",
      ".okoCCCCCCCCoko.",
      "..ooCCCCCCCCoo..",
      "..okkCCCCCCkko..",
      "..oooooooooooo..",
    ],
    drum0: [
      ...TANUKI_FRONT,
      "..oTTTTTTTTTTo..",
      ".oTTkkCCCCkkTTo.",
      ".oTokkCCCCkkoTo.",
      "..ooCCCCCCCCoo..",
      "..okkCCCCCCkko..",
      "..oooooooooooo..",
    ],
    drum1: [
      ...TANUKI_FRONT,
      ".okTTTTTTTTTTko.",
      ".okkTCCCCCCTkko.",
      "..ooCCCCCCCCoo..",
      "..ooCCCCCCCCoo..",
      "..okkCCCCCCkko..",
      "..oooooooooooo..",
    ],
  },
};

// ---- 飛ばす小物（音符・寝息・泡・ハート） ----

const NOTE: Sprite = {
  px: 1.6,
  palette: { k: "#6a78d6" },
  frames: { note: ["..kk..", "..k.k.", "..k..k", "..k...", ".kk...", "kkk...", ".k...."] },
};

const ZZZ: Sprite = {
  px: 1.6,
  palette: { k: "#7c8bb0" },
  frames: { z: ["kkkkk", "...k.", "..k..", ".k...", "kkkkk"] },
};

const BUBBLE: Sprite = {
  px: 1.6,
  palette: { o: "#7fc4ee", w: "#ffffff" },
  frames: { bubble: [".oo.", "o.wo", "o..o", ".oo."] },
};

const HEART: Sprite = {
  px: 1.6,
  palette: { r: "#f27a9a" },
  frames: { heart: [".rr.rr.", "rrrrrrr", "rrrrrrr", ".rrrrr.", "..rrr..", "...r..."] },
};

export const MORE_CUTE_SPRITES = {
  goldfish: GOLDFISH,
  cat: CAT,
  dog: DOG,
  hamster: HAMSTER,
  horse: HORSE,
  dolphin: DOLPHIN,
  dolphinFin: DOLPHIN_FIN,
  fox: FOX,
  tanuki: TANUKI,
  note: NOTE,
  zzz: ZZZ,
  bubble: BUBBLE,
  heart: HEART,
} satisfies Record<string, Sprite>;
