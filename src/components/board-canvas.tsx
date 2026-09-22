"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Edge,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { TopicNode, type TopicFlowNode } from "@/components/topic-node";
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
  const { fitView } = useReactFlow();
  const lastSignature = useRef("");
  const [nodes, setNodes] = useState<TopicFlowNode[]>(() => toFlowNodes(board, overlay));
  const edges = useMemo(() => toFlowEdges(board), [board]);

  useEffect(() => {
    const signature = board.nodes
      .map((node) => `${node.id}:${node.data.label}:${node.data.memo}:${node.data.expanding}:${node.data.placeholder ? 1 : 0}:${node.position.x}:${node.position.y}`)
      .join("|");
    const withFocus = `${board.id}:${board.focusedNodeId}:${board.pinnedNodeId}:${signature}`;
    if (withFocus === lastSignature.current) return;
    lastSignature.current = withFocus;
    setNodes(toFlowNodes(board, overlay));
  }, [board, overlay]);

  useEffect(() => {
    if (!overlay || board.nodes.length === 0) return;
    const timer = window.setTimeout(() => {
      void fitView({ padding: 0.18, duration: 280 });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [board.nodes.length, fitView, overlay]);

  const onNodesChange = useCallback(
    (changes: NodeChange<TopicFlowNode>[]) => {
      setNodes((current) => {
        const next = applyNodeChanges(changes, current);
        if (changes.some((change) => change.type === "position" && change.dragging === false)) {
          const positions: Record<string, { x: number; y: number }> = {};
          for (const node of next) positions[node.id] = node.position;
          onPositions(positions);
        }
        return next;
      });
    },
    [onPositions],
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
      fitViewOptions={{ padding: overlay ? 0.18 : 0.28 }}
      minZoom={0.25}
      maxZoom={1.8}
      nodesConnectable={false}
      nodesDraggable={!overlay}
      elementsSelectable
      panOnScroll
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
          <Controls showInteractive={false} className="!shadow-none" />
          <MiniMap
            pannable
            zoomable
            className="hidden !bg-card/80 !border-border overflow-hidden rounded-lg sm:block"
            maskColor="color-mix(in oklab, var(--background) 72%, transparent)"
          />
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
