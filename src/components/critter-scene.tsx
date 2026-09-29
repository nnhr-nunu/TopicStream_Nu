"use client";

import { memo, useEffect, useMemo, useRef, type CSSProperties } from "react";

import { castFor, EMIT_SPRITES, type Actor, type Gait } from "@/lib/critter-cast";
import { cutePlanner, stay, type CritterMove, type Emit } from "@/lib/critter-moves";
import { realPlanner } from "@/lib/critter-moves-window";
import { spriteRuns, spriteSize, type Sprite } from "@/lib/critter-sprite";
import { critterPaths, waterChannels, type CritterCard, type CritterKind, type CritterStyle, type Pt } from "@/lib/wait-critters";

/**
 * 小さな動物（ピクセルアート）の1場面。cards の座標の上を歩く（置き場所の左上が 0,0）。
 * AI の待ち（wait-critters.tsx）と、ほかの画面のカードの一覧（ambient-critters.tsx）で使う
 */

/** 待ちが終わってから消えるまで（締めの動き = 小鳥が飛び立つ・蝶々が停まる を見せる分） */
export const LEAVE_MS = 2600;
/** 締めの動きのある動物が、消え始めるまで */
const FINALE_MS: Partial<Record<CritterKind, number>> = { bird: 1000, butterfly: 1700 };
/** 小物が消えるまで */
const FX_MS = { note: 1300, z: 1700, bubble: 1300, heart: 1100 } as const;

const frameOf = (sprite: Sprite) => Object.keys(sprite.frames)[0]!;

/** 絵の全コマを重ねて描き、見せるコマだけ表示する（コマの切り替えで React を描き直さない） */
const SpriteFrames = memo(function SpriteFrames({ sprite, index }: { sprite: Sprite; index: number }) {
  const { w, h } = spriteSize(sprite);
  return (
    <svg
      data-sprite={index}
      viewBox={`0 0 ${w} ${h}`}
      width={w * sprite.px}
      height={h * sprite.px}
      shapeRendering="crispEdges"
      style={{ display: "none" }}
    >
      {Object.entries(sprite.frames).map(([name, rows]) => (
        <g key={name} data-frame={name} style={{ display: "none" }}>
          {spriteRuns(rows, sprite.palette).map((run) => (
            <rect key={`${run.x}-${run.y}`} x={run.x} y={run.y} width={run.w} height={1} fill={run.fill} />
          ))}
        </g>
      ))}
    </svg>
  );
});

/** 小物（音符など）を DOM に直接足すときの SVG */
const markupCache = new Map<Sprite, string>();
function spriteMarkup(sprite: Sprite): string {
  const cached = markupCache.get(sprite);
  if (cached) return cached;
  const { w, h } = spriteSize(sprite);
  const rects = spriteRuns(sprite.frames[frameOf(sprite)]!, sprite.palette)
    .map((run) => `<rect x="${run.x}" y="${run.y}" width="${run.w}" height="1" fill="${run.fill}"/>`)
    .join("");
  const markup = `<svg viewBox="0 0 ${w} ${h}" width="${w * sprite.px}" height="${h * sprite.px}" shape-rendering="crispEdges">${rects}</svg>`;
  markupCache.set(sprite, markup);
  return markup;
}

const actorSprites = (actor: Actor) => [...new Set(Object.values(actor.gaits).map((gait) => gait.sprite))];

/** 足元の影の幅（最初の絵の幅の 7 割） */
function shadowWidth(actor: Actor): number {
  const sprite = Object.values(actor.gaits)[0]!.sprite;
  return spriteSize(sprite).w * sprite.px * 0.7;
}

/** 角度を -180〜180 に */
const wrap = (deg: number) => ((((deg % 360) + 540) % 360) - 180);

/** 行列の先頭が通った跡（古い順）をさかのぼって、先頭から distances だけ後ろの位置 */
function alongTrail(points: Pt[], head: Pt, distances: number[]): Pt[] {
  const out: Pt[] = [];
  let cursor = head;
  let walked = 0;
  let index = points.length - 1;
  for (const want of distances) {
    for (;;) {
      if (index < 0) {
        out.push(cursor);
        break;
      }
      const point = points[index]!;
      const seg = Math.hypot(cursor.x - point.x, cursor.y - point.y);
      if (walked + seg >= want) {
        const t = seg === 0 ? 0 : (want - walked) / seg;
        out.push({ x: cursor.x + (point.x - cursor.x) * t, y: cursor.y + (point.y - cursor.y) * t });
        break;
      }
      walked += seg;
      cursor = point;
      index -= 1;
    }
  }
  return out;
}

/** 角の丸い長方形（空のカードの窓） */
function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
}

/** カードの枠線と角の丸み（globals.css のマンダラートのカード）の内側だけを見せる */
function windowClip(cards: CritterCard[]): string {
  const holes = cards.filter((card) => card.empty).map((card) => roundedRect(card.x + 1, card.y + 1, card.w - 2, card.h - 2, 13));
  return `path("${holes.length > 0 ? holes.join(" ") : "M0,0 Z"}")`;
}

export function CritterScene({ kind, style, cards, leaving }: { kind: CritterKind; style: CritterStyle; cards: CritterCard[]; leaving: boolean }) {
  const cast = castFor(kind, style);
  const rootRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef(cards);
  const leavingRef = useRef(leaving);
  useEffect(() => {
    cardsRef.current = cards;
    leavingRef.current = leaving;
    // リスのどんぐりは、そのカードに語が入ったら消す
    for (const acorn of rootRef.current?.querySelectorAll<HTMLElement>(".wait-critter-acorn") ?? []) {
      acorn.classList.toggle("is-gone", !cards[Number(acorn.dataset.card)]?.empty);
    }
  }, [cards, leaving]);

  useEffect(() => {
    const root = rootRef.current;
    const fx = root?.querySelector<HTMLElement>(".wait-critter-fx");
    if (!root || !fx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const actors = cast.actors.map((actor, index) => {
      const el = root.querySelector<HTMLElement>(`[data-actor="${index}"]`)!;
      const svgs = [...el.querySelectorAll<SVGSVGElement>("svg[data-sprite]")];
      const frames = new Map<string, SVGGElement>();
      svgs.forEach((svg, sprite) => {
        for (const group of svg.querySelectorAll<SVGGElement>("g[data-frame]")) frames.set(`${sprite}:${group.dataset.frame}`, group);
      });
      return {
        actor,
        el,
        body: el.querySelector<HTMLElement>(".wait-critter-body")!,
        shadow: el.querySelector<HTMLElement>(".wait-critter-shadow")!,
        sprites: actorSprites(actor),
        svgs,
        frames,
        shownSvg: null as SVGSVGElement | null,
        shownFrame: null as SVGGElement | null,
        placed: "",
        pos: { x: 0, y: 0 },
        flip: false,
      };
    });

    const lead = Object.values(cast.actors[0]!.gaits)[0]!.sprite;
    const leadSize = spriteSize(lead);
    const context = {
      cards: () => cardsRef.current,
      rand: Math.random,
      size: { w: leadSize.w * lead.px, h: leadSize.h * lead.px },
      trail: cast.actors.slice(1).reduce((sum, actor) => sum + (actor.follow ?? 0), 0),
    };
    const planner = style === "real" ? realPlanner(kind, context) : cutePlanner(kind, context);

    const timers = new Set<number>();
    const later = (ms: number, run: () => void) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        run();
      }, ms);
      timers.add(id);
    };

    const spawn = (emit: Emit) => {
      const from = actors[Math.min(emit.actor ?? 0, actors.length - 1)]!.pos;
      const at = emit.at ?? { x: from.x + (emit.dx ?? 0), y: from.y + (emit.dy ?? 0) };
      const el = document.createElement("div");
      el.style.left = `${at.x}px`;
      el.style.top = `${at.y}px`;
      if (emit.kind === "splash") {
        el.className = "wait-critter-splash";
        el.innerHTML = Array.from({ length: 6 }, (_, index) => {
          const dx = (index - 2.5) * 5;
          return `<span style="--dx:${dx}px;--dy:${-9 - (index % 3) * 5}px"></span>`;
        }).join("");
        fx.appendChild(el);
        later(700, () => el.remove());
        return;
      }
      if (emit.kind === "acorn") {
        // 足元から、カードの中へぽとんと落とす（待ちが終わるまで残す）
        el.className = "wait-critter-acorn";
        el.dataset.card = String(emit.card ?? -1);
        el.style.setProperty("--from-x", `${from.x - at.x}px`);
        el.style.setProperty("--from-y", `${from.y - 10 - at.y}px`);
        el.innerHTML = spriteMarkup(EMIT_SPRITES.acorn);
        fx.appendChild(el);
        return;
      }
      el.className = `wait-critter-puff is-${emit.kind}`;
      el.innerHTML = spriteMarkup(EMIT_SPRITES[emit.kind]);
      fx.appendChild(el);
      later(FX_MS[emit.kind], () => el.remove());
    };

    const show = (item: (typeof actors)[number], gait: Gait, frame: string) => {
      const index = item.sprites.indexOf(gait.sprite);
      const svg = item.svgs[index];
      if (!svg) return;
      if (svg !== item.shownSvg) {
        if (item.shownSvg) item.shownSvg.style.display = "none";
        svg.style.display = "";
        item.shownSvg = svg;
      }
      const placed = `${index}:${gait.anchor ?? "feet"}`;
      if (item.placed !== placed) {
        const { w, h } = spriteSize(gait.sprite);
        svg.style.left = `${(-w * gait.sprite.px) / 2}px`;
        svg.style.top = `${gait.anchor === "center" ? (-h * gait.sprite.px) / 2 : -h * gait.sprite.px}px`;
        item.placed = placed;
      }
      const group = item.frames.get(`${index}:${frame}`) ?? null;
      if (group !== item.shownFrame) {
        if (item.shownFrame) item.shownFrame.style.display = "none";
        if (group) group.style.display = "";
        item.shownFrame = group;
      }
    };

    const paint = (
      item: (typeof actors)[number],
      name: string,
      pos: Pt,
      flip: boolean,
      moving: boolean,
      now: number,
      lift: number,
      angle: number,
    ) => {
      const gaits = item.actor.gaits;
      const gait = gaits[name] ?? (moving ? (gaits.walk ?? gaits.run) : undefined) ?? Object.values(gaits)[0]!;
      const ms = gait.ms ?? 200;
      show(item, gait, gait.frames[Math.floor(now / ms) % gait.frames.length]!);
      let tilt = 0;
      let bob = 0;
      let facing = flip;
      if (gait.motion === "waddle" && moving) {
        const phase = (now / 190) * Math.PI;
        tilt = Math.sin(phase) * 7;
        bob = Math.abs(Math.sin(phase)) * 1.2;
      } else if (gait.motion === "trot" && moving) {
        bob = Math.abs(Math.sin((now / ms) * Math.PI)) * 1.4;
      } else if (gait.motion === "flutter") {
        bob = Math.sin(now / 150) * 3;
        tilt = Math.sin(now / 230) * 6;
      } else if (gait.motion === "swim") {
        tilt = Math.sin(now / 260) * 6;
      } else if (gait.motion === "spin") {
        facing = Math.floor(now / 150) % 2 === 1 ? !flip : flip;
      }
      const feet = gait.anchor === "center" ? (spriteSize(gait.sprite).h * gait.sprite.px) / 2 : 0;
      item.pos = pos;
      item.el.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
      item.body.style.transform = `translateY(${-(lift + bob)}px) rotate(${angle + tilt}deg)${facing ? " scaleX(-1)" : ""}`;
      item.shadow.style.display = gait.shadow === false ? "none" : "";
      item.shadow.style.transform = `translate(-50%, calc(-50% + ${feet}px)) scale(${Math.max(0.45, 1 - lift / 90)})`;
    };

    let move: CritterMove = planner.next();
    let startedAt = performance.now();
    let flip = move.flip ?? false;
    let turnFrom = move.turn ?? 0;
    let turnTo = turnFrom;
    let turnAt = startedAt;
    const turnNow = (now: number) => turnFrom + (turnTo - turnFrom) * Math.min(1, (now - turnAt) / 220);
    const begin = (next: CritterMove, now: number) => {
      move = next;
      startedAt = now;
      if (next.flip !== undefined) flip = next.flip;
      if (next.turn !== undefined && next.turn !== turnTo) {
        turnFrom = turnNow(now);
        turnTo = turnFrom + wrap(next.turn - turnFrom);
        turnAt = now;
      }
      for (const emit of next.emit ?? []) later(emit.delay ?? 0, () => spawn(emit));
    };
    for (const emit of move.emit ?? []) later(emit.delay ?? 0, () => spawn(emit));

    // 行列の後ろの子は、先頭が通った跡をたどる（最初はまっすぐ後ろに並べておく）
    const gaps = cast.actors.slice(1).map((actor) => actor.follow ?? 20);
    const distances = gaps.map((_, index) => gaps.slice(0, index + 1).reduce((sum, gap) => sum + gap, 0));
    const trail: Pt[] = [];
    if (gaps.length > 0) {
      const back = move.to.x >= move.from.x ? -1 : 1;
      for (let step = Math.ceil((distances.at(-1)! + 10) / 2); step > 0; step -= 1) {
        trail.push({ x: move.from.x + back * step * 2, y: move.from.y });
      }
    }

    let finale = false;
    let pending: CritterMove[] = [];
    let raf = 0;
    const tick = (now: number) => {
      if (leavingRef.current && !finale) {
        finale = true;
        const here = actors[0]!.pos;
        const moves = planner.finale?.() ?? [];
        pending = moves.slice(1);
        begin(moves[0] ? { ...moves[0], from: { ...here } } : stay(here, 60_000, move.from === move.to ? move.gait : "sit"), now);
      }
      // 裏のタブから戻ったときなどは、止まっていた分を飛ばして今から動かす
      if (now - startedAt > move.ms + 2_000) startedAt = now;
      while (now - startedAt >= move.ms) {
        const done = startedAt + move.ms;
        begin(finale ? (pending.shift() ?? stay(move.to, 60_000, move.gait)) : planner.next(), done);
      }
      const progress = Math.min(1, (now - startedAt) / move.ms);
      const eased = move.ease ? progress * progress * (3 - 2 * progress) : progress;
      const pos = { x: move.from.x + (move.to.x - move.from.x) * eased, y: move.from.y + (move.to.y - move.from.y) * eased };
      const moving = move.from.x !== move.to.x || move.from.y !== move.to.y;
      const arc = move.hop ? move.hop * 4 * progress * (1 - progress) : 0;
      let angle = turnNow(now);
      if (move.arcTilt && move.hop) {
        const deg = (Math.atan2(move.to.y - move.from.y - move.hop * 4 * (1 - 2 * progress), move.to.x - move.from.x) * 180) / Math.PI;
        angle = flip ? wrap(deg - 180) : deg;
      } else if (move.hop && !move.arcTilt) {
        angle += Math.sign(move.to.x - move.from.x) * Math.sin(progress * Math.PI) * (style === "real" ? 5 : 10);
      }
      paint(actors[0]!, move.gait, pos, flip, moving, now, arc, angle);

      if (gaps.length > 0) {
        const last = trail.at(-1);
        if (!last || Math.hypot(pos.x - last.x, pos.y - last.y) >= 1.5) trail.push(pos);
        if (trail.length > 400) trail.splice(0, 100);
        alongTrail(trail, pos, distances).forEach((spot, index) => {
          const item = actors[index + 1]!;
          const dx = spot.x - item.pos.x;
          const walking = Math.hypot(dx, spot.y - item.pos.y) > 0.05;
          if (Math.abs(dx) > 0.3) item.flip = dx < 0;
          paint(item, walking ? "walk" : move.gait, spot, item.flip, walking, now + index * 90, 0, 0);
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      for (const id of timers) window.clearTimeout(id);
      fx.replaceChildren();
    };
  }, [cast, kind, style]);

  const decor = useMemo(() => {
    if (cast.water === "channels") {
      return waterChannels(critterPaths(cards)).map((rect, index) => (
        <span key={index} className="wait-critter-water" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />
      ));
    }
    if (style !== "real") return null;
    return cards
      .filter((card) => card.empty)
      .map((card, index) => (
        <span
          key={index}
          className={cast.water === "tank" ? "wait-critter-tank" : cast.water === "sea" ? "wait-critter-sea" : "wait-critter-ground"}
          style={{ left: card.x, top: card.y, width: card.w, height: card.h }}
        />
      ));
  }, [cast.water, cards, style]);

  const finaleMs = style === "cute" ? (FINALE_MS[kind] ?? 0) : 0;
  const rootStyle: CSSProperties = {
    ...(style === "real" ? { clipPath: windowClip(cards) } : {}),
    ...(leaving ? { transitionDelay: `${finaleMs}ms` } : {}),
  };
  return (
    <div ref={rootRef} className={leaving ? "wait-critter is-leaving" : "wait-critter"} style={rootStyle} data-kind={kind} aria-hidden>
      <div className="wait-critter-fade">
        {decor}
        {/* 後ろについて歩く子を先に描き、先頭を手前にする */}
        {cast.actors
          .map((actor, index) => ({ actor, index }))
          .reverse()
          .map(({ actor, index }) => (
            <div key={index} className="wait-critter-actor" data-actor={index}>
              <span className="wait-critter-shadow" style={{ width: shadowWidth(actor) }} />
              <div className="wait-critter-body">
                {actorSprites(actor).map((sprite, spriteIndex) => (
                  <SpriteFrames key={spriteIndex} sprite={sprite} index={spriteIndex} />
                ))}
              </div>
            </div>
          ))}
        <div className="wait-critter-fx" />
      </div>
    </div>
  );
}
