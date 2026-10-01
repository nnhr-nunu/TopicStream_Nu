"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ViewportPortal } from "@xyflow/react";

import { CritterScene, LEAVE_MS } from "@/components/critter-scene";
import { getBoardSnapshot, getServerBoardSnapshot, subscribeBoardStore } from "@/lib/board-store";
import { CENTER_CELL_INDEX } from "@/lib/mandala-ids";
import {
  dropLeaving,
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

/**
 * AI の語を待っている 3×3 で、小さな動物（ピクセルアート）を遊ばせる。
 * 何が出るかは待ちごとにランダム（設定でしまった動物は出ない。絵のタッチも設定で選べる）。待ちが終わると消える
 */
export function WaitCritters({ nodes, focusedId }: { nodes: CritterNode[]; focusedId: string | null }) {
  const settings = useSyncExternalStore(subscribeBoardStore, selectSettings, selectServerSettings);
  const previewParam = usePreviewCritter();
  const preview = useMemo(() => parsePreview(previewParam), [previewParam]);
  const previewTarget = useMemo(
    () => (preview ? previewGroup(nodes, focusedId, CENTER_CELL_INDEX) : null),
    [preview, nodes, focusedId],
  );

  // 終わった待ちは少しだけ残して、締めの動きと消える様子を見せる
  const [track, setTrack] = useState(() => trackWaits(NO_WAITS, nodes));
  const [seen, setSeen] = useState(nodes);
  if (seen !== nodes) {
    setSeen(nodes);
    setTrack((current) => trackWaits(current, nodes));
  }
  // 消える時間は待ちごとに数える（まとめて数え直すと、待ちが次々に終わる間は前の場面が見えないまま動き続ける）
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
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) window.clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const choose = (wait: CritterWait) => pickCritter(wait.seed, settings.hiddenCritters, settings.critterStyle);
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
