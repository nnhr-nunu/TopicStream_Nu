"use client";

import { Redo2, RefreshCw, Share2, Undo2 } from "lucide-react";

import { BoardSwitcher } from "@/components/board-switcher";
import { BrandMark } from "@/components/brand-mark";
import { SettingsSheet } from "@/components/settings-sheet";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Board, Settings } from "@/lib/types";

function Tip({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function AppToolbar({
  boards,
  activeBoard,
  settings,
  canUndo,
  canRedo,
  canRegenerate,
  hasNodes,
  onHome,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  onExport,
  onImport,
  onUndo,
  onRedo,
  onRegenerate,
  onShare,
  onPatchSettings,
}: {
  boards: Board[];
  activeBoard: Board;
  settings: Settings;
  canUndo: boolean;
  canRedo: boolean;
  canRegenerate: boolean;
  hasNodes: boolean;
  onHome: () => void;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onExport: () => void;
  onImport: (text: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onRegenerate: () => void;
  onShare: () => void;
  onPatchSettings: (patch: Partial<Settings>) => void;
}) {
  return (
    <header className="app-chrome pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-4">
      <div className="pointer-events-auto flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-background/75 px-1.5 py-1 shadow-lg backdrop-blur-md">
        <BrandMark onHome={onHome} compact />
        <BoardSwitcher
          boards={boards}
          activeBoard={activeBoard}
          onSwitch={onSwitch}
          onCreate={onCreate}
          onRename={onRename}
          onDelete={onDelete}
          onExport={onExport}
          onImport={onImport}
        />
      </div>

      <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1 rounded-2xl border border-border/70 bg-background/75 p-1 shadow-lg backdrop-blur-md">
        <Tip label="1つ戻る (Z)">
          <Button size="icon-sm" variant="ghost" aria-label="1つ戻る" onClick={onUndo} disabled={!canUndo}>
            <Undo2 />
          </Button>
        </Tip>
        <Tip label="進む (Y)">
          <Button size="icon-sm" variant="ghost" aria-label="進む" onClick={onRedo} disabled={!canRedo}>
            <Redo2 />
          </Button>
        </Tip>
        <Tip label="再生成 (G)">
          <Button size="icon-sm" variant="ghost" aria-label="再生成" onClick={onRegenerate} disabled={!canRegenerate}>
            <RefreshCw />
          </Button>
        </Tip>
        <Tip label="いっしょに見るリンク">
          <Button size="icon-sm" variant="ghost" aria-label="いっしょに見るリンク" onClick={onShare} disabled={!hasNodes}>
            <Share2 />
          </Button>
        </Tip>
        <SettingsSheet settings={settings} onPatch={onPatchSettings} />
      </div>
    </header>
  );
}
