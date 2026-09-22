"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import { useReactFlow, useViewport } from "@xyflow/react";

import { Button } from "@/components/ui/button";

export function ZoomDock() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const percent = Math.round(zoom * 100);

  return (
    <div className="pointer-events-none absolute bottom-4 left-3 z-20 sm:left-4">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-2xl border border-border/70 bg-background/85 p-1 shadow-lg backdrop-blur-md">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-11 min-w-11 px-2.5"
          aria-label="縮小"
          onClick={() => void zoomOut({ duration: 180 })}
        >
          <Minus />
        </Button>
        <span className="min-w-12 px-1 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {percent}%
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-11 min-w-11 px-2.5"
          aria-label="拡大"
          onClick={() => void zoomIn({ duration: 180 })}
        >
          <Plus />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-11 px-3"
          aria-label="全体を画面に合わせる"
          onClick={() => void fitView({ padding: 0.22, duration: 280, maxZoom: 1.15 })}
        >
          <Maximize2 />
          全体
        </Button>
      </div>
    </div>
  );
}
