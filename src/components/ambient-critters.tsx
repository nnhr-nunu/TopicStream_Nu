"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { CritterScene, LEAVE_MS } from "@/components/critter-scene";
import { ambientCards, AMBIENT_TIMING, between, pickAmbientKind } from "@/lib/ambient-critters";
import { getBoardSnapshot, getServerBoardSnapshot, subscribeBoardStore } from "@/lib/board-store";
import { isCritterKind, type CritterCard, type CritterKind } from "@/lib/wait-critters";

type Visit = { id: number; kind: CritterKind; garden: HTMLElement; perches: HTMLElement[]; cards: CritterCard[]; leaving: boolean };

/** 一覧（data-critter-garden）の中のカード（data-critter-perch）の、一覧の左上からの位置 */
function measure(garden: HTMLElement, perches: HTMLElement[]): CritterCard[] {
  const box = garden.getBoundingClientRect();
  return perches.map((perch) => {
    const rect = perch.getBoundingClientRect();
    return { x: rect.left - box.left - garden.clientLeft, y: rect.top - box.top - garden.clientTop, w: rect.width, h: rect.height };
  });
}

/** 画面に見えている一覧から、遊ぶカードを選ぶ */
function findSpot(rand: () => number): { garden: HTMLElement; perches: HTMLElement[]; cards: CritterCard[] } | null {
  const gardens = [...document.querySelectorAll<HTMLElement>("[data-critter-garden]")];
  for (const garden of gardens.sort(() => rand() - 0.5)) {
    const all = [...garden.querySelectorAll<HTMLElement>("[data-critter-perch]")].filter(
      (perch) => perch.closest("[data-critter-garden]") === garden && perch.offsetWidth > 0,
    );
    const rects = measure(garden, all);
    const box = garden.getBoundingClientRect();
    const cards = ambientCards(rects, { top: -box.top, bottom: window.innerHeight - box.top }, rand);
    if (!cards) continue;
    return { garden, perches: cards.map((card) => all[rects.indexOf(card)]!), cards };
  }
  return null;
}

const same = (a: CritterCard[], b: CritterCard[]) =>
  a.length === b.length && a.every((card, index) => Math.abs(card.x - b[index]!.x) + Math.abs(card.y - b[index]!.y) + Math.abs(card.w - b[index]!.w) < 2);

// 配列は store の書き込みごとに作り直されることがあるので、文字列にして比べる（変わるたびに来ている子が帰らないように）
const selectHidden = () => getBoardSnapshot().settings.hiddenCritters.join(",");
const selectServerHidden = () => getServerBoardSnapshot().settings.hiddenCritters.join(",");

/**
 * トップ・図鑑などのカードの一覧に、時々動物が遊びに来る（かわいい絵だけ。しばらく遊ぶと帰って、少しして別の子が来る）。
 * 一覧に data-critter-garden、カードに data-critter-perch を付けると、その上を歩く。
 * ?critter=frog で、その動物がすぐ来て帰らない（見た目の確認用）
 */
export function AmbientCritters() {
  const hidden = useSyncExternalStore(subscribeBoardStore, selectHidden, selectServerHidden);
  const [visit, setVisit] = useState<Visit | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const forced = new URLSearchParams(window.location.search).get("critter")?.split("-")[0];
    const pinned = isCritterKind(forced) ? forced : null;
    const rand = Math.random;
    let timer = 0;
    let watch = 0;
    let count = 0;
    let last: CritterKind | null = null;
    let current: Visit | null = null;
    const set = (next: Visit | null) => {
      current = next;
      setVisit(next);
    };
    const wait = (ms: number, run: () => void) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, ms);
    };

    const leave = (quick: boolean) => {
      if (!current || current.leaving) return;
      window.clearInterval(watch);
      if (quick) {
        set(null);
        wait(between(rand, AMBIENT_TIMING.gap), arrive);
        return;
      }
      set({ ...current, leaving: true });
      wait(LEAVE_MS, () => {
        set(null);
        wait(between(rand, AMBIENT_TIMING.gap), arrive);
      });
    };

    function arrive() {
      const kind = pinned ?? pickAmbientKind(hidden.split(","), rand, last);
      const spot = document.hidden || !kind ? null : findSpot(rand);
      if (!kind || !spot) {
        wait(1000, arrive);
        return;
      }
      last = kind;
      count += 1;
      set({ id: count, kind, ...spot, leaving: false });
      // カードが消えた・動いた（絞り込み・画面の幅の変更・別のページ）ら、すぐ帰る
      watch = window.setInterval(() => {
        if (!current || current.leaving) return;
        const gone = current.perches.some((perch) => !perch.isConnected);
        if (gone || !same(measure(current.garden, current.perches), current.cards)) leave(true);
      }, 800);
      if (!pinned) wait(between(rand, AMBIENT_TIMING.stay), () => leave(false));
    }

    wait(pinned ? 300 : between(rand, AMBIENT_TIMING.first), arrive);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(watch);
      set(null);
    };
  }, [hidden]);

  if (!visit) return null;
  return createPortal(
    <CritterScene key={visit.id} kind={visit.kind} style="cute" cards={visit.cards} leaving={visit.leaving} />,
    visit.garden,
  );
}
