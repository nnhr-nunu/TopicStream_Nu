"use client";

import { Redo2, RefreshCw, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ExpandControls({
  canUndo,
  canRedo,
  canRegenerate,
  busy,
  onUndo,
  onRedo,
  onRegenerate,
}: {
  canUndo: boolean;
  canRedo: boolean;
  canRegenerate: boolean;
  busy?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-border/70 bg-background/80 p-1 shadow-lg backdrop-blur-md">
        <Button size="sm" variant="ghost" onClick={onUndo} disabled={!canUndo}>
          <Undo2 />
          1つ戻る
        </Button>
        <Button size="sm" variant="ghost" onClick={onRedo} disabled={!canRedo}>
          <Redo2 />
          進む
        </Button>
        <Button size="sm" variant="ghost" onClick={onRegenerate} disabled={!canRegenerate || busy}>
          <RefreshCw />
          再生成
        </Button>
      </div>
    </div>
  );
}
