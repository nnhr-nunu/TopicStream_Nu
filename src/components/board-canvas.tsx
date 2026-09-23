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
import { CENTER_CELL_INDEX } from "@/lib/mandala-ids";
import type { Board, GenerationLayout } from "@/lib/types";
import { cn } from "@/lib/utils";

const nodeTypes = { topic: TopicNode };

function canvasFitPadding(overlay: boolean) {
  if (overlay) return 0.16;
  const narrow = typeof window !== "undefined" && window.innerWidth < 720;
  const px = (value: number): `${number}px` => `${value}px`;
  return {
    top: px(narrow ? 108 : 88),
    bottom: px(narrow ? 88 : 72),
    left: px(narrow ? 12 : 28),
    right: px(narrow ? 12 : 28),
  };
}

function canvasFitZoom(overlay: boolean) {
  const narrow = !overlay && typeof window !== "undefined" && window.innerWidth < 720;
  return {
    maxZoom: overlay ? 1.05 : narrow ? 0.95 : 1.18,
    minZoom: 0.2,
  };
}

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

function toFlowEdges(board: Board, layout: GenerationLayout): Edge[] {
  return board.edges
    .filter((edge) => {
      if (layout !== "mandala") return true;
      const target = board.nodes.find((node) => node.id === edge.target);
      return target?.data.role === "source" || target?.data.cellIndex === CENTER_CELL_INDEX;
    })
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      selectable: false,
    }));
}

function CanvasInner({
  board,
  overlay,
  layout,
  onFocus,
  onPositions,
}: {
  board: Board;
  overlay: boolean;
  layout: GenerationLayout;
  onFocus: (id: string | null) => void;
  onPositions: (positions: Record<string, { x: number; y: number }>) => void;
}) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const liveIds = useMemo(() => new Set(board.nodes.map((node) => node.id)), [board]);
  const signature = `${board.id}:${overlay}:${layout}:${board.focusedNodeId}:${board.pinnedNodeId}:${board.nodes
    .map((node) => `${node.id}:${node.data.label}:${node.data.memo}:${node.data.heartCount ?? 0}:${node.data.expanding ? 1 : 0}:${node.data.placeholder ? 1 : 0}:${node.position.x}:${node.position.y}`)
    .join("|")}`;
  const [nodes, setNodes] = useState<TopicFlowNode[]>(() => toFlowNodes(board, overlay));
  const [seenSignature, setSeenSignature] = useState(signature);
  const prevIds = useRef<Set<string> | null>(null);
  const boardIdRef = useRef(board.id);
  const clusterRef = useRef<string[]>([]);
  const clusterUntil = useRef(0);
  const edges = useMemo(() => toFlowEdges(board, layout), [board, layout]);
  if (signature !== seenSignature) {
    setSeenSignature(signature);
    setNodes(toFlowNodes(board, overlay));
  }

  const fitCluster = useCallback(
    (ids: string[], graph: Board["nodes"]) => {
      const present = ids.filter((id) => graph.some((node) => node.id === id));
      if (present.length === 0) return;
      const zoom = canvasFitZoom(overlay);
      void fitView({
        nodes: present.map((id) => ({ id })),
        padding: canvasFitPadding(overlay),
        duration: 280,
        ...zoom,
      }).then((ok) => {
        if (ok) return;
        void fitView({ padding: canvasFitPadding(overlay), duration: 260, ...zoom });
      });
    },
    [fitView, overlay],
  );

  const idsKey = board.nodes.map((node) => node.id).join(",");

  useEffect(() => {
    const graph = board.nodes;
    const ids = new Set(graph.map((node) => node.id));
    const prev = prevIds.current;
    const boardChanged = boardIdRef.current !== board.id;
    boardIdRef.current = board.id;
    prevIds.current = ids;
    if (graph.length === 0) {
      clusterRef.current = [];
      return;
    }

    const added = prev ? [...ids].filter((id) => !prev.has(id)) : [];
    const fitSoon = (fn: () => void) => {
      const first = window.setTimeout(fn, 360);
      const second = window.setTimeout(fn, 920);
      return () => {
        window.clearTimeout(first);
        window.clearTimeout(second);
      };
    };

    if (boardChanged || prev === null) {
      return fitSoon(() => {
        if (added.length > 0) {
          const parents = [
            ...new Set(
              added
                .map((id) => graph.find((node) => node.id === id)?.data.parentId)
                .filter((id): id is string => Boolean(id)),
            ),
          ];
          clusterRef.current = [...parents, ...added];
          clusterUntil.current = Date.now() + 1400;
          fitCluster(clusterRef.current, graph);
          return;
        }
        void fitView({ padding: canvasFitPadding(overlay), duration: 240, ...canvasFitZoom(overlay) });
      });
    }

    if (added.length > 0) {
      const parents = [
        ...new Set(
          added
            .map((id) => graph.find((node) => node.id === id)?.data.parentId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      clusterRef.current = [...parents, ...added];
      clusterUntil.current = Date.now() + 1400;
      return fitSoon(() => fitCluster(clusterRef.current, graph));
    }

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idsKey is the node-identity key; listing board.nodes spreads and changes dep count
  }, [board.id, fitCluster, fitView, idsKey, overlay]);

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
      fitView={false}
      defaultViewport={{ x: 0, y: 0, zoom: 1 }}
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
  layout?: GenerationLayout;
  onFocus: (id: string | null) => void;
  onPositions: (positions: Record<string, { x: number; y: number }>) => void;
}) {
  const layout =
    props.layout ??
    (props.board.nodes.some((node) => typeof node.data.groupId === "number") ? "mandala" : "radial");
  return (
    <div className="h-full min-h-0 w-full flex-1">
      <ReactFlowProvider>
        <CanvasInner {...props} overlay={props.overlay ?? false} layout={layout} />
      </ReactFlowProvider>
    </div>
  );
}
