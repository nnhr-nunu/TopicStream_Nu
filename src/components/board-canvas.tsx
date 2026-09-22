"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Edge,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { TopicNode, type TopicFlowNode } from "@/components/topic-node";
import { ZoomDock } from "@/components/zoom-dock";
import type { Board } from "@/lib/types";
import { cn } from "@/lib/utils";

const nodeTypes = { topic: TopicNode };

function toFlowNodes(board: Board, overlay: boolean): TopicFlowNode[] {
  return board.nodes.map((node) => ({
    id: node.id,
    type: "topic",
    position: node.position,
    data: node.data,
    selected: board.focusedNodeId === node.id,
    draggable: !overlay,
  }));
}

function toFlowEdges(board: Board): Edge[] {
  return board.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    selectable: false,
  }));
}

function CanvasInner({
  board,
  overlay,
  onFocus,
  onPositions,
}: {
  board: Board;
  overlay: boolean;
  onFocus: (id: string | null) => void;
  onPositions: (positions: Record<string, { x: number; y: number }>) => void;
}) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const liveIds = useMemo(() => new Set(board.nodes.map((node) => node.id)), [board]);
  const signature = `${board.id}:${overlay}:${board.focusedNodeId}:${board.pinnedNodeId}:${board.nodes
    .map((node) => `${node.id}:${node.data.label}:${node.data.memo}:${node.data.expanding ? 1 : 0}:${node.data.placeholder ? 1 : 0}:${node.position.x}:${node.position.y}`)
    .join("|")}`;
  const [nodes, setNodes] = useState<TopicFlowNode[]>(() => toFlowNodes(board, overlay));
  const [seenSignature, setSeenSignature] = useState(signature);
  const prevCount = useRef(board.nodes.length);
  const edges = useMemo(() => toFlowEdges(board), [board]);
  if (signature !== seenSignature) {
    setSeenSignature(signature);
    setNodes(toFlowNodes(board, overlay));
  }

  useEffect(() => {
    const grew = board.nodes.length > prevCount.current;
    prevCount.current = board.nodes.length;
    if (board.nodes.length === 0) return;
    if (!grew && !overlay) return;
    const timer = window.setTimeout(() => {
      void fitView({ padding: overlay ? 0.16 : 0.22, duration: 320, maxZoom: overlay ? 1.05 : 1.12 });
    }, grew ? 70 : 40);
    return () => window.clearTimeout(timer);
  }, [board.nodes.length, board.id, fitView, overlay]);

  useEffect(() => {
    if (overlay) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        void zoomIn({ duration: 160 });
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        void zoomOut({ duration: 160 });
        return;
      }
      if (event.key === "0" || event.key.toLowerCase() === "f") {
        event.preventDefault();
        void fitView({ padding: 0.22, duration: 260, maxZoom: 1.15 });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fitView, overlay, zoomIn, zoomOut]);

  const onNodesChange = useCallback(
    (changes: NodeChange<TopicFlowNode>[]) => {
      setNodes((current) => {
        const next = applyNodeChanges(changes, current).filter((node) => liveIds.has(node.id));
        if (changes.some((change) => change.type === "position" && change.dragging === false)) {
          const positions: Record<string, { x: number; y: number }> = {};
          for (const node of next) positions[node.id] = node.position;
          onPositions(positions);
        }
        return next;
      });
    },
    [liveIds, onPositions],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={(_, node) => onFocus(node.id)}
      onPaneClick={() => undefined}
      fitView={board.nodes.length > 0}
      fitViewOptions={{ padding: overlay ? 0.16 : 0.22, maxZoom: 1.12 }}
      minZoom={0.2}
      maxZoom={2.2}
      nodeOrigin={[0.5, 0.5]}
      nodesConnectable={false}
      nodesDraggable={!overlay}
      elementsSelectable
      panOnDrag
      panOnScroll={false}
      zoomOnScroll
      zoomOnPinch
      zoomOnDoubleClick={false}
      deleteKeyCode={null}
      multiSelectionKeyCode={null}
      proOptions={{ hideAttribution: overlay }}
      defaultEdgeOptions={{
        type: "default",
        animated: false,
        style: { stroke: "color-mix(in oklab, var(--primary) 55%, transparent)", strokeWidth: 1.7 },
      }}
      className={cn("h-full w-full", overlay && "overlay-flow")}
    >
      {overlay ? null : (
        <>
          <Background
            variant={BackgroundVariant.Dots}
            gap={28}
            size={1.1}
            color="color-mix(in oklab, var(--foreground) 14%, transparent)"
          />
          <ZoomDock />
        </>
      )}
    </ReactFlow>
  );
}

export function BoardCanvas(props: {
  board: Board;
  overlay?: boolean;
  onFocus: (id: string | null) => void;
  onPositions: (positions: Record<string, { x: number; y: number }>) => void;
}) {
  return (
    <div className="h-full min-h-0 w-full flex-1">
      <ReactFlowProvider>
        <CanvasInner {...props} overlay={props.overlay ?? false} />
      </ReactFlowProvider>
    </div>
  );
}
