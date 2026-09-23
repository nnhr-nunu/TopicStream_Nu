"use client";

import { memo, useEffect, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import { useBoardActions } from "@/components/board-actions";
import { NodeDraftEditor, TopicActionsMenu, useMenuHold } from "@/components/topic-actions-menu";
import { LABEL_EDIT_MAX, MEMO_MAX } from "@/lib/constants";
import { fitLabelFontSize } from "@/lib/fit-label";
import { cellCode } from "@/lib/mandala-ids";
import { MANDALA_CHIP_H, MANDALA_CHIP_W } from "@/lib/node-box";
import { cn } from "@/lib/utils";
import type { TopicNodeData } from "@/lib/types";

export type TopicFlowNode = Node<TopicNodeData, "topic">;

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return coarse;
}

function TopicNodeComponent({ id, data, selected }: NodeProps<TopicFlowNode>) {
  const {
    expandNode,
    regenerateNode,
    pinNode,
    setMemo,
    setLabel,
    copyLabel,
    overlay,
    pinnedNodeId,
    focusedNodeId,
    generationLayout,
  } = useBoardActions();
  const [copied, setCopied] = useState(false);
  const [editor, setEditor] = useState<"label" | "memo" | null>(null);
  const menu = useMenuHold();
  const coarse = useCoarsePointer();
  const isPinned = pinnedNodeId === id;
  const isFocused = focusedNodeId === id || selected;
  const isRoot = data.parentId === null;
  const isMandala = generationLayout === "mandala";
  const code =
    typeof data.groupId === "number" && typeof data.cellIndex === "number"
      ? cellCode(data.groupId, data.cellIndex)
      : "";
  const family = data.familyIndex ?? 0;
  const role = data.role ?? (data.cellIndex === 4 ? "source" : "keyword");
  const canExpand = !data.expanded && !data.expanding && !data.placeholder;
  const fontSize = isMandala
    ? fitLabelFontSize(data.label, MANDALA_CHIP_W - 28, MANDALA_CHIP_H - 28, isRoot ? 16 : 15, 9)
    : fitLabelFontSize(data.label, 16 * 16 - 36, 72, isRoot ? 17 : 15, 10);

  const openEditor = (next: "label" | "memo") => {
    menu.setLocked(true);
    menu.show();
    setEditor(next);
  };

  const closeEditor = () => {
    setEditor(null);
    menu.setLocked(false);
  };

  return (
    <div
      className={cn("topic-node relative", overlay && "topic-node-overlay")}
      data-family={family}
      data-role={role}
      data-cell={data.cellIndex}
      onPointerEnter={() => {
        if (!overlay && !coarse) menu.show();
      }}
      onPointerLeave={() => {
        if (!overlay) menu.hideSoon();
      }}
      style={{
        animationDelay: `${data.appearIndex * 58}ms`,
        ["--sprout-x" as string]: `${Math.max(-72, Math.min(72, (data.sproutX ?? 0) * 0.28))}px`,
        ["--sprout-y" as string]: `${Math.max(-72, Math.min(72, (data.sproutY ?? 16) * 0.28))}px`,
      }}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0 !h-1 !w-1 !border-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !h-1 !w-1 !border-0" />

      {data.memo ? (
        <aside className="sticky-note" aria-label="付箋">
          {data.memo}
        </aside>
      ) : null}

      <button
        type="button"
        className={cn(
          "topic-chip",
          isRoot && "topic-chip-root",
          isPinned && "topic-chip-now",
          isFocused && "topic-chip-focus",
          data.expanding && "topic-chip-busy",
          data.placeholder && "topic-chip-skeleton",
          role === "source" && "topic-chip-source",
          role === "keyword" && "topic-chip-keyword",
        )}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          if (data.placeholder || data.expanding) return;
          if (overlay) {
            if (canExpand) expandNode(id);
            return;
          }
          const pointerType = "pointerType" in event.nativeEvent ? event.nativeEvent.pointerType : "";
          if (pointerType === "touch" || coarse) {
            if (menu.open) menu.hideNow();
            else menu.show();
            return;
          }
          if (canExpand) expandNode(id);
        }}
      >
        {data.placeholder ? (
          <span className="topic-skeleton" aria-label="話題を準備中">
            <span className="topic-skeleton-bud" />
            <span className="topic-skeleton-bar" />
          </span>
        ) : (
          <>
            {code ? <span className="topic-id">{code}</span> : null}
            <span className="topic-label" style={{ fontSize: `${fontSize}px` }}>
              {data.label}
            </span>
          </>
        )}
      </button>

      {overlay || editor !== "label" ? null : (
        <NodeDraftEditor
          title="カードの文"
          value={data.label}
          maxLength={LABEL_EDIT_MAX}
          placeholder="話したいことを書く"
          onCommit={(next) => {
            setLabel?.(id, next);
            closeEditor();
          }}
          onCancel={closeEditor}
        />
      )}

      {overlay || editor !== "memo" ? null : (
        <NodeDraftEditor
          title="付箋（マスの大きさは変わりません）"
          value={data.memo}
          maxLength={MEMO_MAX}
          placeholder="エピソード、オチ、リスナーの反応…"
          onCommit={(next) => {
            setMemo(id, next);
            closeEditor();
          }}
          onCancel={closeEditor}
        />
      )}

      {overlay ? null : (
        <TopicActionsMenu
          open={menu.open || Boolean(editor)}
          onOpenChange={menu.setOpen}
          isPinned={isPinned}
          canExpand={!data.expanding && !data.placeholder}
          copied={copied}
          onExpand={() => expandNode(id)}
          onPin={() => pinNode(id)}
          onRegenerate={() => regenerateNode?.(id)}
          onCopy={async () => {
            await copyLabel(id);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
          onEditLabel={() => openEditor("label")}
          onEditMemo={() => openEditor("memo")}
          onPointerEnter={menu.show}
          onPointerLeave={menu.hideSoon}
        />
      )}
    </div>
  );
}

export const TopicNode = memo(TopicNodeComponent);
