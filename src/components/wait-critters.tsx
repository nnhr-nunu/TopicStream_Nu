"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ViewportPortal } from "@xyflow/react";

import { CritterScene, LEAVE_MS } from "@/components/critter-scene";
import { getBoardSnapshot, getServerBoardSnapshot, subscribeBoardStore } from "@/lib/board-store";
import { CENTER_CELL_INDEX } from "@/lib/mandala-ids";
import {
  isCritterKind,
  pickCritter,
  previewGroup,
  waitingGroups,
  type CritterGroup,
  type CritterKind,
  type CritterNode,
  type CritterStyle,
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
  const groups = useMemo(() => waitingGroups(nodes), [nodes]);
  const previewParam = usePreviewCritter();
  const preview = useMemo(() => parsePreview(previewParam), [previewParam]);
  const previewTarget = useMemo(
    () => (preview ? previewGroup(nodes, focusedId, CENTER_CELL_INDEX) : null),
    [preview, nodes, focusedId],
  );

  // 終わった待ちは少しだけ残して、締めの動きと消える様子を見せる
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

  const choose = (group: CritterGroup) => pickCritter(group.seed, settings.hiddenCritters, settings.critterStyle);
  const shown = [
    ...groups.map((group) => ({ group, leaving: false, pick: choose(group) })),
    ...leaving
      .filter((group) => !groups.some((item) => item.key === group.key))
      .map((group) => ({ group, leaving: true, pick: choose(group) })),
  ];
  if (preview && previewTarget) {
    const pick = preview.kind
      ? { kind: preview.kind, style: preview.style ?? "cute" }
      : pickCritter(previewTarget.seed, [], preview.style ?? "mix");
    shown.push({ group: { ...previewTarget, key: `preview-${previewTarget.key}` }, leaving: false, pick });
  }
  const scenes = shown.filter((item): item is typeof item & { pick: NonNullable<typeof item.pick> } => item.pick !== null);
  if (scenes.length === 0) return null;

  return (
    <ViewportPortal>
      {scenes.map(({ group, leaving: out, pick }) => (
        <CritterScene key={`${group.key}:${pick.kind}:${pick.style}`} kind={pick.kind} style={pick.style} cards={group.cards} leaving={out} />
      ))}
    </ViewportPortal>
  );
}
