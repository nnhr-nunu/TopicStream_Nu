"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useNodesInitialized,
  useReactFlow,
  useStore,
  type Edge,
  type NodeChange,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { CombineGhost, CombinePickBanner, CombineProvider, nodeIdAt, type CombineApi } from "@/components/combine-drag";
import { FlowEdge } from "@/components/flow-edge";
import { TopicNode, type TopicFlowNode } from "@/components/topic-node";
import { WaitCritters } from "@/components/wait-critters";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { cellCode, CENTER_CELL_INDEX } from "@/lib/mandala-ids";
import type { Board, GenerationLayout } from "@/lib/types";
import { cn } from "@/lib/utils";

const nodeTypes = { topic: TopicNode };
const edgeTypes = { flow: FlowEdge };
/** 既定の辺スタイル（細い線）はインラインで付くので、流れの線は明示して上書きする */
const FLOW_EDGE_STYLE = {
  stroke: "color-mix(in oklab, var(--primary) 80%, var(--foreground))",
  strokeWidth: 3,
  strokeOpacity: 0.7,
};

function canvasFitPadding(overlay: boolean, pinned = false) {
  if (overlay) return 0.16;
  const narrow = typeof window !== "undefined" && window.innerWidth < 720;
  const px = (value: number): `${number}px` => `${value}px`;
  // ピン留めの帯（ヘッダーの下）がある間は、その分だけ上を空ける
  const banner = pinned ? (narrow ? 76 : 96) : 0;
  return {
    top: px((narrow ? 108 : 88) + banner),
    bottom: px(narrow ? 96 : 86),
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

/** マンダラートで開いたマス → 開いた先の3×3の中央コード（例: 1F → 2E）。 */
function openedCodes(board: Board): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of board.nodes) {
    const from = node.data.copiedFromId;
    if (!from || typeof node.data.groupId !== "number" || typeof node.data.cellIndex !== "number") continue;
    const code = cellCode(node.data.groupId, node.data.cellIndex);
    if (code) map.set(from, code);
  }
  return map;
}

/** draggable: PC で掛け合わせができるとき（スマホは長押ししてから動かすので、React Flow のドラッグは使わない） */
function toFlowNodes(board: Board, draggable: boolean): TopicFlowNode[] {
  const opened = openedCodes(board);
  return board.nodes.map((node) => ({
    id: node.id,
    type: "topic",
    position: node.position,
    data: opened.has(node.id) ? { ...node.data, openedCode: opened.get(node.id) } : node.data,
    selected: board.focusedNodeId === node.id,
    draggable: draggable && !node.data.placeholder,
  }));
}

/** ドラッグ中の指・カーソルの位置 */
function pointOf(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
  if ("clientX" in event) return { x: event.clientX, y: event.clientY };
  const touch = event.changedTouches[0] ?? event.touches[0];
  return touch ? { x: touch.clientX, y: touch.clientY } : null;
}

/** 掛け合わせでできたカードへの、持ってきた側からの線（点線で区別する） */
function isMixEdge(board: Board, edge: Board["edges"][number]): boolean {
  const target = board.nodes.find((node) => node.id === edge.target);
  return Boolean(target?.data.mixedFromId && target.data.mixedFromId === edge.source);
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
      // どちらの並べ方でも、親 → 子の向きが分かる矢じり付きの線にする（放射は曲げを弱く）
      type: "flow",
      ...(layout === "mandala" ? { style: FLOW_EDGE_STYLE } : { data: { soft: true } }),
      ...(isMixEdge(board, edge) ? { className: "mix-edge" } : {}),
    }));
}

function CanvasInner({
  board,
  overlay,
  layout,
  onFocus,
  onCombine,
  children,
}: {
  board: Board;
  overlay: boolean;
  layout: GenerationLayout;
  onFocus: (id: string | null) => void;
  onCombine?: (sourceId: string, targetId: string) => void;
  children?: ReactNode;
}) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const coarse = useCoarsePointer();
  const combining = !overlay && Boolean(onCombine);
  const mouseDrag = combining && !coarse;
  const liveIds = useMemo(() => new Set(board.nodes.map((node) => node.id)), [board]);
  const signature = `${board.id}:${overlay}:${layout}:${board.focusedNodeId}:${board.pinnedNodeId}:${board.nodes
    .map((node) => {
      const d = node.data;
      // カードの見た目に効く値はすべて入れる（入れ忘れると再読み込みまで画面に出ない）。
      return `${node.id}:${d.label}:${d.memo}:${d.heartCount ?? 0}:${d.frameHearts ?? 0}:${d.expanding ? 1 : 0}:${d.expanded ? 1 : 0}:${d.placeholder ? 1 : 0}:${d.role ?? ""}:${d.groupId ?? ""}:${d.cellIndex ?? ""}:${d.familyIndex ?? ""}:${node.position.x}:${node.position.y}`;
    })
    .join("|")}`;
  const [nodes, setNodes] = useState<TopicFlowNode[]>(() => toFlowNodes(board, mouseDrag));
  const [seenSignature, setSeenSignature] = useState(signature);
  const prevIds = useRef<Set<string> | null>(null);
  const boardIdRef = useRef(board.id);
  const clusterRef = useRef<string[]>([]);
  const clusterUntil = useRef(0);
  const edges = useMemo(() => toFlowEdges(board, layout), [board, layout]);
  const pinned = Boolean(board.pinnedNodeId);
  const [seenDrag, setSeenDrag] = useState(mouseDrag);
  if (signature !== seenSignature || seenDrag !== mouseDrag) {
    setSeenSignature(signature);
    setSeenDrag(mouseDrag);
    setNodes(toFlowNodes(board, mouseDrag));
  }

  const fitCluster = useCallback(
    (ids: string[], graph: Board["nodes"]) => {
      const present = ids.filter((id) => graph.some((node) => node.id === id));
      if (present.length === 0) return;
      const zoom = canvasFitZoom(overlay);
      void fitView({
        nodes: present.map((id) => ({ id })),
        padding: canvasFitPadding(overlay, pinned),
        duration: 280,
        ...zoom,
      }).then((ok) => {
        if (ok) return;
        void fitView({ padding: canvasFitPadding(overlay, pinned), duration: 260, ...zoom });
      });
    },
    [fitView, overlay, pinned],
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
        void fitView({ padding: canvasFitPadding(overlay, pinned), duration: 240, ...canvasFitZoom(overlay) });
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
  }, [board.id, fitCluster, fitView, idsKey, overlay, pinned]);

  // 非表示のタブで開いたときなど、最初の fit の時点でカードの寸法が測れていないことがある。
  // 寸法が取れた最初のタイミングで、そのボードを一度だけ画面に合わせ直す。
  const nodesInitialized = useNodesInitialized();
  const initialFitBoard = useRef<string | null>(null);
  useEffect(() => {
    if (!nodesInitialized || board.nodes.length === 0) return;
    // ボードや広げかた（マンダラート / 放射）が変わったら合わせ直す
    const key = `${board.id}:${layout}`;
    if (initialFitBoard.current === key) return;
    const first = initialFitBoard.current === null;
    initialFitBoard.current = key;
    void fitView({ padding: canvasFitPadding(overlay, pinned), duration: first ? 0 : 260, ...canvasFitZoom(overlay) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ボード・広げかたごとに1回だけ
  }, [nodesInitialized, board.id, layout]);

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
        // 上のピン留めの帯・左下の切り替えにカードが隠れないよう、自動で合わせるときと同じ余白にする
        void fitView({ padding: canvasFitPadding(overlay, pinned), duration: 260, ...canvasFitZoom(overlay) });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fitView, overlay, pinned, zoomIn, zoomOut]);

  const onNodesChange = useCallback(
    (changes: NodeChange<TopicFlowNode>[]) => {
      setNodes((current) => applyNodeChanges(changes, current).filter((node) => liveIds.has(node.id)));
    },
    [liveIds],
  );

  // ---- 掛け合わせ（カードを別のカードに重ねる） ----
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [pickFrom, setPickFrom] = useState<string | null>(null);
  const [touchDrag, setTouchDrag] = useState<{ id: string; label: string; x: number; y: number } | null>(null);
  const dropTargetRef = useRef<string | null>(null);
  const touchIdRef = useRef<string | null>(null);
  const droppedAt = useRef(0);
  const onCombineRef = useRef(onCombine);
  useEffect(() => {
    onCombineRef.current = onCombine;
  }, [onCombine]);

  const markTarget = useCallback((id: string | null) => {
    if (dropTargetRef.current === id) return;
    dropTargetRef.current = id;
    setDropTarget(id);
  }, []);
  const finishDrop = useCallback(
    (sourceId: string, targetId: string | null) => {
      markTarget(null);
      droppedAt.current = Date.now();
      if (targetId) onCombineRef.current?.(sourceId, targetId);
    },
    [markTarget],
  );

  const onNodeDrag: OnNodeDrag<TopicFlowNode> = (event, node) => {
    const point = pointOf(event);
    markTarget(point ? nodeIdAt(point.x, point.y, node.id) : null);
  };
  // どこにも重ならずに離したら元の位置へ（掛け合わせたときも、持ってきたカードは元の場所に戻す）
  const onNodeDragStop: OnNodeDrag<TopicFlowNode> = (event, node) => {
    const point = pointOf(event);
    const target = point ? nodeIdAt(point.x, point.y, node.id) : null;
    setReturningId(node.id);
    window.setTimeout(() => setReturningId((id) => (id === node.id ? null : id)), 300);
    setNodes(toFlowNodes(board, mouseDrag));
    finishDrop(node.id, target);
  };

  useEffect(() => {
    if (!pickFrom) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickFrom(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pickFrom]);

  // カードが毎回描き直されないよう、中身が変わったときだけ作り直す
  const combineApi = useMemo<CombineApi | null>(
    () =>
      combining
        ? {
            pickFrom,
            startPick: (id) => setPickFrom(id),
            cancelPick: () => setPickFrom(null),
            pickTarget: (id) => {
              if (!pickFrom) return false;
              setPickFrom(null);
              if (id !== pickFrom) onCombineRef.current?.(pickFrom, id);
              return true;
            },
            justDropped: () => Date.now() - droppedAt.current < 400,
            touchStart: (id, label, x, y) => {
              touchIdRef.current = id;
              setTouchDrag({ id, label, x, y });
              markTarget(nodeIdAt(x, y, id));
            },
            touchMove: (x, y) => {
              const id = touchIdRef.current;
              if (!id) return;
              setTouchDrag((drag) => (drag ? { ...drag, x, y } : drag));
              markTarget(nodeIdAt(x, y, id));
            },
            touchEnd: (x, y) => {
              const id = touchIdRef.current;
              if (!id) return;
              touchIdRef.current = null;
              setTouchDrag(null);
              finishDrop(id, nodeIdAt(x, y, id));
            },
            touchCancel: () => {
              touchIdRef.current = null;
              setTouchDrag(null);
              markTarget(null);
            },
          }
        : null,
    [combining, pickFrom, markTarget, finishDrop],
  );

  const liftedId = touchDrag?.id ?? null;
  const shownNodes = useMemo(() => {
    if (!dropTarget && !returningId && !pickFrom && !liftedId) return nodes;
    return nodes.map((node) => {
      const classes = [
        node.id === dropTarget && "combine-target",
        node.id === returningId && "combine-return",
        (node.id === pickFrom || node.id === liftedId) && "combine-source",
        pickFrom && node.id !== pickFrom && !node.data.placeholder && "combine-candidate",
      ].filter(Boolean);
      return classes.length ? { ...node, className: classes.join(" ") } : node;
    });
  }, [nodes, dropTarget, returningId, pickFrom, liftedId]);
  const pickLabel = pickFrom ? (board.nodes.find((node) => node.id === pickFrom)?.data.label ?? "") : "";

  return (
    <CombineProvider value={combineApi}>
    <ReactFlow
      nodes={shownNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={(_, node) => onFocus(node.id)}
      onNodeDrag={mouseDrag ? onNodeDrag : undefined}
      onNodeDragStop={mouseDrag ? onNodeDragStop : undefined}
      onPaneClick={() => setPickFrom(null)}
      fitView={false}
      defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      fitViewOptions={{ padding: overlay ? 0.16 : 0.22, maxZoom: 1.12 }}
      minZoom={0.2}
      maxZoom={2.2}
      nodeOrigin={[0.5, 0.5]}
      nodesConnectable={false}
      nodesDraggable={mouseDrag}
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
      <WaitCritters nodes={nodes} focusedId={board.focusedNodeId} />
      {overlay ? null : (
        <>
          <Background
            variant={BackgroundVariant.Dots}
            gap={28}
            size={1.1}
            color="color-mix(in oklab, var(--foreground) 14%, transparent)"
          />
          <ZoomVar />
          {children}
          {pickFrom ? <CombinePickBanner label={pickLabel} onCancel={() => setPickFrom(null)} /> : null}
        </>
      )}
    </ReactFlow>
    {touchDrag
      ? createPortal(
          <CombineGhost label={touchDrag.label} x={touchDrag.x} y={touchDrag.y} over={Boolean(dropTarget)} />,
          document.body,
        )
      : null}
    </CombineProvider>
  );
}

export function BoardCanvas(props: {
  board: Board;
  overlay?: boolean;
  layout?: GenerationLayout;
  onFocus: (id: string | null) => void;
  /** 渡したときだけ、カードを別のカードに重ねて掛け合わせられる */
  onCombine?: (sourceId: string, targetId: string) => void;
  /** キャンバスの上に重ねて出す操作（左下の切り替えなど） */
  children?: ReactNode;
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

/** 引いた（縮小した）ときにカードのメニューが小さくなりすぎないよう、倍率を CSS に渡す（globals.css の --rf-zoom） */
function ZoomVar() {
  const zoom = useStore((state) => state.transform[2]);
  const domNode = useStore((state) => state.domNode);
  useEffect(() => {
    domNode?.style.setProperty("--rf-zoom", String(zoom));
  }, [domNode, zoom]);
  return null;
}
