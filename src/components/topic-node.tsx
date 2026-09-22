"use client";

import { memo, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Check, Copy, Loader2, Pin, RefreshCw, StickyNote } from "lucide-react";

import { useBoardActions } from "@/components/board-actions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { MEMO_MAX } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TopicNodeData } from "@/lib/types";

export type TopicFlowNode = Node<TopicNodeData, "topic">;

function TopicNodeComponent({ id, data, selected }: NodeProps<TopicFlowNode>) {
  const { expandNode, regenerateNode, pinNode, setMemo, copyLabel, overlay, pinnedNodeId, focusedNodeId } =
    useBoardActions();
  const [copied, setCopied] = useState(false);
  const isPinned = pinnedNodeId === id;
  const isFocused = focusedNodeId === id || selected;
  const isRoot = data.parentId === null;

  return (
    <div
      className={cn("topic-node relative", overlay && "topic-node-overlay")}
      style={{ animationDelay: `${data.appearIndex * 38}ms` }}
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
        )}
        onClick={(event) => {
          event.stopPropagation();
          if (!data.expanded && !data.expanding && !data.placeholder) expandNode(id);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          document.getElementById(`memo-${id}`)?.click();
        }}
      >
        {data.expanding ? <Loader2 className="size-4 shrink-0 animate-spin opacity-80" /> : null}
        <span className="topic-label">{data.placeholder ? "考え中" : data.label}</span>
        {isPinned ? <span className="now-badge">NOW</span> : null}
      </button>

      {overlay ? null : (
        <div className="topic-actions">
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={isPinned ? "ピンを外す" : "いま話している"}
            onClick={(event) => {
              event.stopPropagation();
              pinNode(id);
            }}
          >
            <Pin className={cn(isPinned && "fill-current")} />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="再生成"
            onClick={(event) => {
              event.stopPropagation();
              regenerateNode?.(id);
            }}
          >
            <RefreshCw />
          </Button>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  id={`memo-${id}`}
                  size="icon-xs"
                  variant="ghost"
                  aria-label="付箋を書く"
                />
              }
              onClick={(event) => event.stopPropagation()}
            >
              <StickyNote />
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
              <p className="mb-2 text-xs text-muted-foreground">付箋（ノードの横に残ります）</p>
              <Textarea
                value={data.memo}
                maxLength={MEMO_MAX}
                placeholder="エピソード、オチ、リスナーの反応…"
                onChange={(event) => setMemo(id, event.target.value)}
                className="min-h-20"
              />
              <p className="mt-1 text-right text-[10px] text-muted-foreground">
                {data.memo.length}/{MEMO_MAX}
              </p>
            </PopoverContent>
          </Popover>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="ラベルをコピー"
            onClick={async (event) => {
              event.stopPropagation();
              await copyLabel(id);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            }}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
      )}
    </div>
  );
}

export const TopicNode = memo(TopicNodeComponent);
