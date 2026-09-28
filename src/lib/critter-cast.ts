/**
 * 待ち時間の動物の配役: 動きの名前（critter-moves の gait）ごとに、どの絵のどのコマをどう揺らして見せるか。
 * 行列（ひよこ・きつねとたぬき）は2匹目から follow で後ろにつく
 */
import type { Sprite } from "@/lib/critter-sprite";
import { CUTE_SPRITES as C } from "@/lib/critter-sprites-cute";
import { realSprites } from "@/lib/critter-sprites-real";
import type { CritterKind, CritterStyle } from "@/lib/wait-critters";

/** 揺れ方: waddle よちよち（左右に傾く）/ trot 歩くたび弾む / flutter ふわふわ上下 / swim 体をくねらす / spin くるくる回る */
export type Motion = "waddle" | "trot" | "flutter" | "swim" | "spin";

export type Gait = {
  sprite: Sprite;
  frames: string[];
  /** 1コマの長さ（ms） */
  ms?: number;
  motion?: Motion;
  /** 絵のどこを動きの点に合わせるか（feet: 足元。center: 真ん中 = 溝を歩くもの・泳ぐもの・飛ぶもの） */
  anchor?: "feet" | "center";
  /** 足元の影（飛ぶ・泳ぐものは無し） */
  shadow?: boolean;
};

export type Actor = {
  gaits: Record<string, Gait>;
  /** 前の子からどれだけ後ろを歩くか（行列の2匹目から。盤面の座標で） */
  follow?: number;
};

export type Cast = {
  actors: Actor[];
  /** 水: channels は溝を水路に、tank は空のカードを水槽に、sea は空のカードの下半分を海に */
  water?: "channels" | "tank" | "sea";
};

const g = (sprite: Sprite, frames: string[], ms?: number, extra: Partial<Gait> = {}): Gait => ({ sprite, frames, ms, ...extra });
/** ふだんは frame、ときどき blinkFrame（まばたき・耳ぴく） */
const now = (frame: string, blinkFrame: string, every = 18) => [...Array.from({ length: every }, () => frame), blinkFrame];
const center = { anchor: "center" as const };
const air = { anchor: "center" as const, shadow: false };

const CUTE: Record<CritterKind, Cast> = {
  frog: { actors: [{ gaits: { sit: g(C.frog, now("sit", "blink"), 150), jump: g(C.frog, ["jump"]) } }] },
  penguin: {
    actors: [
      {
        gaits: {
          walkSide: g(C.penguin, ["side0", "side1"], 190, { motion: "waddle", ...center }),
          walkFront: g(C.penguin, ["front0", "front1"], 190, { motion: "waddle", ...center }),
          walkBack: g(C.penguin, ["back0", "back1"], 190, { motion: "waddle", ...center }),
          idleSide: g(C.penguin, ["side0"], undefined, center),
          idleFront: g(C.penguin, ["front0"], undefined, center),
          idleBack: g(C.penguin, ["back0"], undefined, center),
          slide: g(C.penguin, ["slide"], undefined, center),
        },
      },
    ],
  },
  rabbit: {
    actors: [
      {
        gaits: {
          sit: g(C.rabbit, ["sit"]),
          rest: g(C.rabbit, [...now("sit", "ear", 6), "sit", "ear", "sit", "sit"], 130),
          hop: g(C.rabbit, ["hop"]),
        },
      },
    ],
  },
  butterfly: {
    actors: [
      {
        gaits: {
          fly: g(C.butterfly, ["open", "mid", "shut", "mid"], 70, { motion: "flutter", ...air }),
          rest: g(C.butterfly, ["open", "open", "open", "open", "mid", "shut", "shut", "mid"], 170, air),
        },
      },
    ],
  },
  chicks: {
    actors: [
      {
        gaits: {
          walk: g(C.hen, ["walk0", "walk1"], 200, { motion: "trot", ...center }),
          peck: g(C.hen, ["walk0", "peck", "peck", "walk0", "walk0"], 240, center),
        },
      },
      ...[26, 20, 20].map((follow) => ({
        follow,
        gaits: {
          walk: g(C.chick, ["walk0", "walk1"], 150, { motion: "trot" as const, ...center }),
          peck: g(C.chick, ["walk0", "peep", "walk0", "walk0"], 200, center),
        },
      })),
    ],
  },
  bird: {
    actors: [
      {
        gaits: {
          sit: g(C.bird, ["sit"]),
          chirp: g(C.bird, ["chirp", "sit", "chirp", "sit"], 160),
          fly: g(C.bird, ["fly0", "fly1"], 90, { shadow: false }),
        },
      },
    ],
  },
  squirrel: {
    actors: [
      {
        gaits: {
          sit: g(C.squirrel, ["sit"]),
          run: g(C.squirrel, ["run0", "run1"], 110),
          nibble: g(C.squirrel, ["nibble0", "nibble1"], 180),
        },
      },
    ],
  },
  goldfish: {
    water: "channels",
    actors: [
      {
        gaits: {
          swim: g(C.goldfish, ["swim0", "swim1"], 200, { motion: "swim", ...air }),
          hover: g(C.goldfish, ["swim0", "swim1"], 420, air),
        },
      },
    ],
  },
  cat: {
    actors: [
      {
        gaits: {
          sit: g(C.cat, ["sit"]),
          walk: g(C.cat, ["walk0", "walk1"], 220, { motion: "trot" }),
          jump: g(C.cat, ["walk1"]),
          sleep: g(C.cat, ["sleep0", "sleep1"], 900),
        },
      },
    ],
  },
  dog: {
    actors: [
      {
        gaits: {
          run: g(C.dog, ["walk0", "walk1"], 120, { motion: "trot", ...center }),
          sit: g(C.dog, ["sit0", "sit1"], 160, center),
          spin: g(C.dog, ["walk0", "walk1"], 120, { motion: "spin", ...center }),
        },
      },
    ],
  },
  hamster: {
    actors: [
      {
        gaits: {
          sit: g(C.hamster, ["sit"]),
          run: g(C.hamster, ["run0", "run1"], 90),
          munch: g(C.hamster, ["munch0", "munch1"], 150),
        },
      },
    ],
  },
  horse: {
    actors: [
      {
        gaits: {
          run: g(C.horse, ["run0", "run1"], 130, { motion: "trot", ...center }),
          stand: g(C.horse, ["stand"], undefined, center),
        },
      },
    ],
  },
  dolphin: {
    water: "channels",
    actors: [{ gaits: { fin: g(C.dolphinFin, ["fin0", "fin1"], 220, air), leap: g(C.dolphin, ["leap"], undefined, air) } }],
  },
  foxtanuki: {
    actors: [
      {
        gaits: {
          walk: g(C.fox, ["walk0", "walk1"], 180, { motion: "trot", ...center }),
          rest: g(C.fox, ["sit"], undefined, center),
        },
      },
      {
        follow: 34,
        gaits: {
          walk: g(C.tanuki, ["walk0", "walk1"], 180, { motion: "trot", ...center }),
          rest: g(C.tanuki, ["drum0", "drum1"], 200, center),
        },
      },
    ],
  },
};

/** リアルな絵の配役（絵を作るのに少し時間がかかるので、最初に使うときに作る） */
function realCasts(R: ReturnType<typeof realSprites>): Record<CritterKind, Cast> {
  return {
    frog: { actors: [{ gaits: { sit: g(R.frog, ["sit"]), jump: g(R.frog, ["jump"]) } }] },
    penguin: {
      actors: [{ gaits: { walk: g(R.penguin, ["walk0", "walk1"], 240, { motion: "waddle" }), stand: g(R.penguin, ["stand"]) } }],
    },
    rabbit: {
      actors: [
        {
          gaits: {
            sit: g(R.rabbit, ["sit"]),
            rest: g(R.rabbit, [...now("sit", "ear", 8), "sit", "ear", "sit", "sit"], 130),
            hop: g(R.rabbit, ["hop"]),
          },
        },
      ],
    },
    butterfly: {
      actors: [
        {
          gaits: {
            fly: g(R.butterfly, ["open", "mid", "shut", "mid"], 80, { motion: "flutter", ...air }),
            rest: g(R.butterfly, ["shut", "shut", "shut", "shut", "mid", "open", "open", "mid"], 200, { anchor: "feet", shadow: false }),
          },
        },
      ],
    },
    chicks: {
      actors: [
        {
          gaits: {
            walk: g(R.hen, ["walk0", "walk1"], 230, { motion: "trot" }),
            peck: g(R.hen, ["walk0", "peck", "peck", "walk0", "walk0"], 260),
          },
        },
        ...[30, 16, 16].map((follow) => ({
          follow,
          gaits: {
            walk: g(R.chick, ["walk0", "walk1"], 150, { motion: "trot" as const }),
            peck: g(R.chick, ["walk0", "peck", "walk0", "walk0"], 200),
          },
        })),
      ],
    },
    bird: {
      actors: [
        {
          gaits: {
            sit: g(R.bird, ["sit"]),
            hop: g(R.bird, ["sit"]),
            peck: g(R.bird, ["sit", "peck", "sit", "peck", "sit", "sit"], 170),
            fly: g(R.bird, ["fly0", "fly1"], 80),
          },
        },
      ],
    },
    squirrel: {
      actors: [
        {
          gaits: {
            sit: g(R.squirrel, ["sit0", "sit0", "sit1", "sit0", "sit1"], 220),
            run: g(R.squirrel, ["run0", "run1"], 100),
          },
        },
      ],
    },
    goldfish: {
      water: "tank",
      actors: [
        {
          gaits: {
            swim: g(R.goldfish, ["swim0", "swim1", "swim2", "swim1"], 170, { motion: "swim", ...air }),
            hover: g(R.goldfish, ["swim0", "swim1", "swim2", "swim1"], 320, air),
          },
        },
      ],
    },
    cat: {
      actors: [{ gaits: { walk: g(R.cat, ["walk0", "walk1", "walk2", "walk1"], 170), sit: g(R.cat, now("sit", "blink", 14), 160) } }],
    },
    dog: {
      actors: [{ gaits: { walk: g(R.dog, ["walk0", "walk1", "walk2", "walk1"], 130), sit: g(R.dog, ["sit0", "sit1"], 180) } }],
    },
    hamster: {
      actors: [{ gaits: { run: g(R.hamster, ["run0", "run1"], 80), sit: g(R.hamster, ["sit0", "sit1"], 200) } }],
    },
    horse: {
      actors: [
        { gaits: { run: g(R.horse, ["run0", "run1", "run2", "run1"], 110), graze: g(R.horse, ["graze0", "graze1"], 600) } },
      ],
    },
    dolphin: {
      water: "sea",
      actors: [
        {
          gaits: {
            swim: g(R.dolphin, ["swim0", "swim1"], 260, { motion: "swim", ...air }),
            leap: g(R.dolphin, ["swim0"], undefined, air),
          },
        },
      ],
    },
    foxtanuki: {
      actors: [
        { gaits: { walk: g(R.fox, ["walk0", "walk1", "walk2", "walk1"], 160), rest: g(R.fox, ["sit"]) } },
        { follow: 50, gaits: { walk: g(R.tanuki, ["walk0", "walk1", "walk2", "walk1"], 160), rest: g(R.tanuki, ["sit"]) } },
      ],
    },
  };
}

let real: Record<CritterKind, Cast> | null = null;

export function castFor(kind: CritterKind, style: CritterStyle): Cast {
  if (style === "cute") return CUTE[kind];
  real ??= realCasts(realSprites());
  return real[kind];
}

/** 設定に並べるアイコン（かわいい絵の1コマ。きつねとたぬきは2匹） */
export const CRITTER_ICONS: Record<CritterKind, { sprite: Sprite; frame: string }[]> = {
  frog: [{ sprite: C.frog, frame: "sit" }],
  penguin: [{ sprite: C.penguin, frame: "front0" }],
  rabbit: [{ sprite: C.rabbit, frame: "sit" }],
  butterfly: [{ sprite: C.butterfly, frame: "open" }],
  chicks: [{ sprite: C.chick, frame: "walk0" }],
  bird: [{ sprite: C.bird, frame: "sit" }],
  squirrel: [{ sprite: C.squirrel, frame: "sit" }],
  goldfish: [{ sprite: C.goldfish, frame: "swim0" }],
  cat: [{ sprite: C.cat, frame: "sit" }],
  dog: [{ sprite: C.dog, frame: "sit0" }],
  hamster: [{ sprite: C.hamster, frame: "sit" }],
  horse: [{ sprite: C.horse, frame: "stand" }],
  dolphin: [{ sprite: C.dolphin, frame: "leap" }],
  foxtanuki: [
    { sprite: C.fox, frame: "sit" },
    { sprite: C.tanuki, frame: "sit" },
  ],
};

/** 飛ばす小物の絵 */
export const EMIT_SPRITES = { note: C.note, z: C.zzz, bubble: C.bubble, heart: C.heart, acorn: C.acorn } as const;
