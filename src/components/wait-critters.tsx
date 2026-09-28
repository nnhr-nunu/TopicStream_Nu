"use client";

import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ViewportPortal } from "@xyflow/react";

import { CENTER_CELL_INDEX } from "@/lib/mandala-ids";
import {
  CRITTER_KINDS,
  CRITTER_PX,
  critterFor,
  critterPaths,
  frogPerch,
  nextFrogMove,
  nextPenguinMove,
  previewGroup,
  SPRITES,
  spriteRuns,
  spriteSize,
  waitingGroups,
  type CritterCard,
  type CritterGroup,
  type CritterKind,
  type CritterMove,
  type CritterNode,
  type FrogState,
  type PenguinState,
} from "@/lib/wait-critters";

/** 待ちが終わったあと、動物がふわっと消えるまで */
const LEAVE_MS = 450;

/** 絵の全コマを重ねて描き、見せるコマだけ表示する（コマの切り替えで React を描き直さない） */
const SpriteSvg = memo(function SpriteSvg({ kind }: { kind: CritterKind }) {
  const sprite = SPRITES[kind];
  const { w, h } = spriteSize(sprite);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w * CRITTER_PX} height={h * CRITTER_PX} shapeRendering="crispEdges">
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

/** 動物ごとの「次の動き」を順に出す */
function mover(kind: CritterKind, cards: () => CritterCard[], rand: () => number): () => CritterMove {
  if (kind === "frog") {
    const start = cards();
    const index = Math.floor(rand() * start.length);
    let frog: FrogState = { card: index, at: frogPerch(start[index]!, rand), resting: false };
    return () => {
      const next = nextFrogMove(frog, cards(), rand);
      frog = next.state;
      return next.move;
    };
  }
  // ペンギンは足元を道の真ん中に合わせる（絵の下端が足）
  const lift = (spriteSize(SPRITES.penguin).h * CRITTER_PX) / 2;
  const first = critterPaths(cards());
  let penguin: PenguinState = {
    i: Math.floor(rand() * first.xs.length),
    j: Math.floor(rand() * first.ys.length),
  };
  let lastPose = "front";
  return () => {
    const paths = critterPaths(cards());
    // カードの並びが変わって道の数が減ったら、はみ出さないように寄せる
    penguin = { i: Math.min(penguin.i, paths.xs.length - 1), j: Math.min(penguin.j, paths.ys.length - 1), from: penguin.from };
    const next = nextPenguinMove(penguin, paths, rand, lastPose);
    penguin = next.state;
    lastPose = next.move.pose;
    const down = (point: { x: number; y: number }) => ({ x: point.x, y: point.y + lift });
    return { ...next.move, from: down(next.move.from), to: down(next.move.to) };
  };
}

function Critter({ kind, cards, leaving }: { kind: CritterKind; cards: CritterCard[]; leaving: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef(cards);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    const root = rootRef.current;
    const body = root?.querySelector<HTMLElement>(".wait-critter-body");
    const shadow = root?.querySelector<HTMLElement>(".wait-critter-shadow");
    if (!root || !body || !shadow) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const frames = new Map(
      [...root.querySelectorAll<SVGGElement>("g[data-frame]")].map((group) => [group.dataset.frame!, group]),
    );
    let shown: SVGGElement | undefined;
    const show = (name: string) => {
      const group = frames.get(name) ?? frames.get(`${name}0`);
      if (group === shown) return;
      if (shown) shown.style.display = "none";
      if (group) group.style.display = "";
      shown = group;
    };

    const next = mover(kind, () => cardsRef.current, Math.random);
    let move = next();
    let flip = move.flip ?? false;
    let startedAt = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      // 裏のタブから戻ったときなどは、止まっていた分を飛ばして今から動かす
      if (now - startedAt > move.ms + 2_000) startedAt = now;
      while (now - startedAt >= move.ms) {
        startedAt += move.ms;
        move = next();
        if (move.flip !== undefined) flip = move.flip;
      }
      const progress = Math.min(1, (now - startedAt) / move.ms);
      const x = move.from.x + (move.to.x - move.from.x) * progress;
      const y = move.from.y + (move.to.y - move.from.y) * progress;
      const arc = move.hop ? move.hop * 4 * progress * (1 - progress) : 0;

      let tilt = 0;
      let bob = 0;
      if (move.steps) {
        // よちよち: 1歩ごとに左右へ傾き、少し弾む
        const phase = (now / 190) * Math.PI;
        tilt = Math.sin(phase) * 7;
        bob = Math.abs(Math.sin(phase)) * 1.2;
        show(`${move.pose}${Math.floor(now / 190) % 2}`);
      } else if (move.hop) {
        tilt = Math.sign(move.to.x - move.from.x) * Math.sin(progress * Math.PI) * 12;
        show(move.pose);
      } else {
        // 休んでいる間は、ときどきまばたき
        show(move.pose === "sit" && now % 2_800 < 150 ? "blink" : move.pose);
      }

      root.style.transform = `translate(${x}px, ${y}px)`;
      body.style.transform = `translateY(${-(arc + bob)}px) rotate(${tilt}deg)${flip ? " scaleX(-1)" : ""}`;
      shadow.style.transform = `scale(${Math.max(0.45, 1 - arc / 90)})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [kind]);

  const { w, h } = spriteSize(SPRITES[kind]);
  return (
    <div ref={rootRef} className={leaving ? "wait-critter is-leaving" : "wait-critter"} data-kind={kind} aria-hidden>
      <div className="wait-critter-fade">
        <span className="wait-critter-shadow" style={{ width: w * CRITTER_PX * 0.8 }} />
        <div
          className="wait-critter-body"
          style={{ left: (-w * CRITTER_PX) / 2, top: -h * CRITTER_PX, width: w * CRITTER_PX, height: h * CRITTER_PX }}
        >
          <SpriteSvg kind={kind} />
        </div>
      </div>
    </div>
  );
}

const subscribeNothing = () => () => {};

/** ?critter=frog / penguin / random で、待っていなくても選んでいる 3×3 に出す（見た目の確認用） */
function usePreviewCritter(): string | null {
  return useSyncExternalStore(
    subscribeNothing,
    () => new URLSearchParams(window.location.search).get("critter"),
    () => null,
  );
}

/**
 * AI の語を待っている 3×3 の上で、小さな動物（ピクセルアート）を遊ばせる。
 * 何が出るかは待ちごとにランダム（CRITTER_KINDS）。待ちが終わるとふわっと消える
 */
export function WaitCritters({ nodes, focusedId }: { nodes: CritterNode[]; focusedId: string | null }) {
  const groups = useMemo(() => waitingGroups(nodes), [nodes]);
  const previewKind = usePreviewCritter();
  const preview = useMemo(
    () => (previewKind ? previewGroup(nodes, focusedId, CENTER_CELL_INDEX) : null),
    [previewKind, nodes, focusedId],
  );

  // 終わった待ちは少しだけ残して、消える動きを見せる
  const [leaving, setLeaving] = useState<CritterGroup[]>([]);
  const [seen, setSeen] = useState(groups);
  if (seen !== groups) {
    const gone = seen.filter((group) => !groups.some((item) => item.key === group.key));
    setSeen(groups);
    if (gone.length > 0) setLeaving((current) => [...current, ...gone]);
  }
  useEffect(() => {
    if (leaving.length === 0) return;
    const timer = window.setTimeout(() => setLeaving([]), LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  const shown = [
    ...groups.map((group) => ({ group, leaving: false, kind: critterFor(group.key) })),
    ...leaving
      .filter((group) => !groups.some((item) => item.key === group.key))
      .map((group) => ({ group, leaving: true, kind: critterFor(group.key) })),
  ];
  if (preview && previewKind) {
    const kind = (CRITTER_KINDS as string[]).includes(previewKind) ? (previewKind as CritterKind) : critterFor(preview.key);
    shown.push({ group: { ...preview, key: `preview-${preview.key}` }, leaving: false, kind });
  }
  if (shown.length === 0) return null;

  return (
    <ViewportPortal>
      {shown.map(({ group, leaving: out, kind }) => (
        <Critter key={`${group.key}:${kind}`} kind={kind} cards={group.cards} leaving={out} />
      ))}
    </ViewportPortal>
  );
}
