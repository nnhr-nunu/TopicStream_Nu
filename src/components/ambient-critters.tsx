"use client";

import { Fragment, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { CritterScene, LEAVE_MS } from "@/components/critter-scene";
import { ambientCards, AMBIENT_TIMING, between, pickAmbientKind, skippedKinds } from "@/lib/ambient-critters";
import { getBoardSnapshot, getServerBoardSnapshot, subscribeBoardStore } from "@/lib/board-store";
import { isCritterKind, type CritterCard, type CritterKind } from "@/lib/wait-critters";

type Visit = { id: number; kind: CritterKind; garden: HTMLElement; perches: HTMLElement[]; cards: CritterCard[]; leaving: boolean };

/** 一覧ごとの様子: 来ている子・次に来てよい時刻・帰る時刻・前に来た子 */
type Plot = { visit: Visit | null; nextAt: number; stayUntil: number; goneAt: number; last: CritterKind | null };

/** 一覧（data-critter-garden）の中のカード（data-critter-perch）の、一覧の左上からの位置 */
function measure(garden: HTMLElement, perches: HTMLElement[]): CritterCard[] {
  const box = garden.getBoundingClientRect();
  return perches.map((perch) => {
    const rect = perch.getBoundingClientRect();
    return { x: rect.left - box.left - garden.clientLeft, y: rect.top - box.top - garden.clientTop, w: rect.width, h: rect.height };
  });
}

/** 画面に見えている一覧のカードから、遊ぶカードを選ぶ */
function findSpot(garden: HTMLElement, rand: () => number): { perches: HTMLElement[]; cards: CritterCard[] } | null {
  const all = [...garden.querySelectorAll<HTMLElement>("[data-critter-perch]")].filter(
    (perch) => perch.closest("[data-critter-garden]") === garden && perch.offsetWidth > 0,
  );
  const rects = measure(garden, all);
  const box = garden.getBoundingClientRect();
  const cards = ambientCards(rects, { top: -box.top, bottom: window.innerHeight - box.top }, rand);
  if (!cards) return null;
  return { perches: cards.map((card) => all[rects.indexOf(card)]!), cards };
}

const same = (a: CritterCard[], b: CritterCard[]) =>
  a.length === b.length && a.every((card, index) => Math.abs(card.x - b[index]!.x) + Math.abs(card.y - b[index]!.y) + Math.abs(card.w - b[index]!.w) < 2);

// 配列は store の書き込みごとに作り直されることがあるので、文字列にして比べる（変わるたびに来ている子が帰らないように）
const selectHidden = () => getBoardSnapshot().settings.hiddenCritters.join(",");
const selectServerHidden = () => getServerBoardSnapshot().settings.hiddenCritters.join(",");

/**
 * トップ・図鑑などのカードの一覧に、動物が遊びに来る（かわいい絵だけ。しばらく遊ぶと帰って、少しして別の子が来る）。
 * 一覧に data-critter-garden、カードに data-critter-perch を付けると、その上を歩く。一覧ごとに1匹ずつ、ほかの一覧とは違う子が来る。
 * 一覧の data-critter-skip="frog" で、その一覧には出さない。?critter=frog で、その動物がすぐ来て帰らない（見た目の確認用）
 */
export function AmbientCritters() {
  const hidden = useSyncExternalStore(subscribeBoardStore, selectHidden, selectServerHidden);
  const [visits, setVisits] = useState<Visit[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const forced = new URLSearchParams(window.location.search).get("critter")?.split("-")[0];
    const pinned = isCritterKind(forced) ? forced : null;
    const rand = Math.random;
    const plots = new Map<HTMLElement, Plot>();
    let count = 0;

    const publish = () => setVisits([...plots.values()].flatMap((plot) => (plot.visit ? [plot.visit] : [])));

    const tick = () => {
      const now = performance.now();
      let changed = false;
      const gardens = new Set(document.querySelectorAll<HTMLElement>("[data-critter-garden]"));
      for (const [garden, plot] of plots) {
        if (gardens.has(garden)) continue;
        plots.delete(garden);
        if (plot.visit) changed = true;
      }
      for (const garden of gardens) {
        if (!plots.has(garden)) {
          plots.set(garden, { visit: null, nextAt: now + (pinned ? 300 : between(rand, AMBIENT_TIMING.first)), stayUntil: 0, goneAt: 0, last: null });
        }
      }

      for (const [garden, plot] of plots) {
        const { visit } = plot;
        if (visit?.leaving) {
          if (now < plot.goneAt) continue;
          plot.visit = null;
          plot.nextAt = now + between(rand, AMBIENT_TIMING.gap);
          changed = true;
          continue;
        }
        if (visit) {
          // カードが消えた・動いた（絞り込み・画面の幅の変更・別のページ）ら、すぐ帰る
          const gone = visit.perches.some((perch) => !perch.isConnected);
          if (gone || !same(measure(garden, visit.perches), visit.cards)) {
            plot.visit = null;
            plot.nextAt = now + between(rand, AMBIENT_TIMING.gap);
            changed = true;
          } else if (!pinned && now >= plot.stayUntil) {
            plot.visit = { ...visit, leaving: true };
            plot.goneAt = now + LEAVE_MS;
            changed = true;
          }
          continue;
        }
        if (now < plot.nextAt || document.hidden) continue;
        // ほかの一覧に来ている子とは違う子にする
        const elsewhere = [...plots.values()].flatMap((other) => (other.visit ? [other.visit.kind] : []));
        const kind = pinned ?? pickAmbientKind([...hidden.split(","), ...skippedKinds(garden.dataset.critterSkip), ...elsewhere], rand, plot.last);
        const spot = kind ? findSpot(garden, rand) : null;
        if (!kind || !spot) {
          plot.nextAt = now + 1000;
          continue;
        }
        count += 1;
        plot.last = kind;
        plot.visit = { id: count, kind, garden, ...spot, leaving: false };
        plot.stayUntil = now + between(rand, AMBIENT_TIMING.stay);
        changed = true;
      }
      if (changed) publish();
    };

    tick();
    const timer = window.setInterval(tick, 400);
    return () => {
      window.clearInterval(timer);
      setVisits([]);
    };
  }, [hidden]);

  return visits.map((visit) => (
    <Fragment key={visit.id}>
      {createPortal(<CritterScene kind={visit.kind} style="cute" cards={visit.cards} leaving={visit.leaving} />, visit.garden)}
    </Fragment>
  ));
}
