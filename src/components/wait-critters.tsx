"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ViewportPortal } from "@xyflow/react";

import { CritterScene, LEAVE_MS } from "@/components/critter-scene";
import { getBoardSnapshot, getServerBoardSnapshot, subscribeBoardStore } from "@/lib/board-store";
import { CENTER_CELL_INDEX } from "@/lib/mandala-ids";
import {
  dropLeaving,
  endLinger,
  isCritterKind,
  NO_WAITS,
  pickCritter,
  previewGroup,
  shownWaits,
  trackWaits,
  type CritterKind,
  type CritterNode,
  type CritterStyle,
  type CritterWait,
} from "@/lib/wait-critters";

const subscribeNothing = () => () => {};

/** ?critter=frog / rabbit-real / random で、待っていなくても選んでいる 3×3 に出す（見た目の確認用） */
function usePreviewCritter(): string | null {
  return useSyncExternalStore(
    subscribeNothing,
    () => new URLSearchParams(window.location.search).get("critter"),
    () => null,
  );
}

function parsePreview(raw: string | null): { kind: CritterKind | null; style: CritterStyle | null } | null {
  if (!raw) return null;
  const [name, look] = raw.split("-");
  return { kind: isCritterKind(name) ? name : null, style: look === "real" || look === "cute" ? look : null };
}

const selectSettings = () => getBoardSnapshot().settings;
const selectServerSettings = () => getServerBoardSnapshot().settings;

/** 出てくるまで（globals.css の .wait-critter-fade: 0.7 秒待って 0.5 秒でふわっと出る） */
const APPEAR_MS = 1200;
/** 語が入って待ちが終わったあとも、かわいい絵の動物が遊び続ける長さ（そのあと締めの動きをして消える） */
const LINGER_MS = 15_000;

/**
 * AI の語を待っている 3×3 で、小さな動物（ピクセルアート）を遊ばせる。
 * 何が出るかは待ちごとにランダム（設定でしまった動物は出ない。絵のタッチも設定で選べる）。
 * 待ちが終わっても、かわいい絵はカードの縁でしばらく遊んでから帰る。リアルな絵は空のカードを窓にして中を歩くので、語が入ると消える
 */
export function WaitCritters({ nodes, focusedId }: { nodes: CritterNode[]; focusedId: string | null }) {
  const settings = useSyncExternalStore(subscribeBoardStore, selectSettings, selectServerSettings);
  const previewParam = usePreviewCritter();
  const preview = useMemo(() => parsePreview(previewParam), [previewParam]);
  const previewTarget = useMemo(
    () => (preview ? previewGroup(nodes, focusedId, CENTER_CELL_INDEX) : null),
    [preview, nodes, focusedId],
  );

  const choose = (wait: CritterWait) => pickCritter(wait.seed, settings.hiddenCritters, settings.critterStyle);
  // 出てくる前に終わった（すぐ終わった）待ちは、そのまま出さない
  const [appeared, setAppeared] = useState<ReadonlySet<number>>(() => new Set());
  const lingers = (wait: CritterWait) => appeared.has(wait.waitNo) && choose(wait)?.style === "cute";

  // 終わった待ちは少し残して、遊び続ける・締めの動きと消える様子を見せる
  const [track, setTrack] = useState(() => trackWaits(NO_WAITS, nodes));
  const [seen, setSeen] = useState(nodes);
  if (seen !== nodes) {
    setSeen(nodes);
    setTrack((current) => trackWaits(current, nodes, lingers));
  }
  // 出てくる時間・遊ぶ時間・消える時間は待ちごとに数える
  // （まとめて数え直すと、語が次々に入って盤面が変わる間は数え始めに戻り続け、時間が来ない）
  const appearTimers = useRef(new Map<number, number>());
  useEffect(() => {
    for (const wait of track.live) {
      if (appeared.has(wait.waitNo) || appearTimers.current.has(wait.waitNo)) continue;
      const timer = window.setTimeout(() => {
        appearTimers.current.delete(wait.waitNo);
        setAppeared((current) => new Set(current).add(wait.waitNo));
      }, APPEAR_MS);
      appearTimers.current.set(wait.waitNo, timer);
    }
  }, [track.live, appeared]);
  const lingerTimers = useRef(new Map<number, number>());
  useEffect(() => {
    for (const wait of track.lingering) {
      if (lingerTimers.current.has(wait.waitNo)) continue;
      const timer = window.setTimeout(() => {
        lingerTimers.current.delete(wait.waitNo);
        setTrack((current) => endLinger(current, wait.waitNo));
      }, LINGER_MS);
      lingerTimers.current.set(wait.waitNo, timer);
    }
  }, [track.lingering]);
  const timers = useRef(new Map<number, number>());
  useEffect(() => {
    for (const wait of track.leaving) {
      if (timers.current.has(wait.waitNo)) continue;
      const timer = window.setTimeout(() => {
        timers.current.delete(wait.waitNo);
        setTrack((current) => dropLeaving(current, wait.waitNo));
      }, LEAVE_MS);
      timers.current.set(wait.waitNo, timer);
    }
  }, [track.leaving]);
  useEffect(() => {
    const all = [appearTimers.current, lingerTimers.current, timers.current];
    return () => {
      for (const pending of all) {
        for (const timer of pending.values()) window.clearTimeout(timer);
        pending.clear();
      }
    };
  }, []);

  const shown = shownWaits(track).map(({ wait, leaving }) => ({ wait, leaving, pick: choose(wait) }));
  if (preview && previewTarget) {
    const pick = preview.kind
      ? { kind: preview.kind, style: preview.style ?? "cute" }
      : pickCritter(previewTarget.seed, [], preview.style ?? "mix");
    shown.push({ wait: { ...previewTarget, key: `preview-${previewTarget.key}`, waitNo: 0 }, leaving: false, pick });
  }
  const scenes = shown.filter((item): item is typeof item & { pick: NonNullable<typeof item.pick> } => item.pick !== null);
  if (scenes.length === 0) return null;

  // key は待ちごとの番号入り: 同じ待ちの間は（終わりかけになっても）同じ場面を使い続け、広げ直した待ちは新しい場面にする
  return (
    <ViewportPortal>
      {scenes.map(({ wait, leaving: out, pick }) => (
        <CritterScene key={`${wait.key}:${wait.waitNo}:${pick.kind}:${pick.style}`} kind={pick.kind} style={pick.style} cards={wait.cards} leaving={out} />
      ))}
    </ViewportPortal>
  );
}
