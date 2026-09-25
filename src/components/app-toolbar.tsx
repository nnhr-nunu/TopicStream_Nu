"use client";

import Link from "next/link";
import { BookOpen, ChevronRight, Redo2, Share2, Undo2 } from "lucide-react";

import { BoardPanel } from "@/components/board-panel";
import { BrandMark } from "@/components/brand-mark";
import { SettingsSheet } from "@/components/settings-sheet";
import { XLogo } from "@/components/share-post-dialog";
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
  atHome,
  canUndo,
  canRedo,
  hasNodes,
  onHome,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  onDuplicate,
  onExport,
  onImport,
  onUndo,
  onRedo,
  onShare,
  onPostToX,
  onPatchSettings,
}: {
  boards: Board[];
  activeBoard: Board;
  settings: Settings;
  atHome: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasNodes: boolean;
  onHome: () => void;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onRename: (name: string, id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onExport: () => void;
  onImport: (text: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onShare: () => void;
  onPostToX: () => void;
  onPatchSettings: (patch: Partial<Settings>) => void;
}) {
  return (
    <header className="app-chrome pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 sm:p-4">
      <nav
        aria-label="現在地"
        className="app-bar pointer-events-auto flex min-w-0 items-center gap-0.5 py-1 pr-1.5 pl-1"
      >
        <BrandMark onHome={onHome} active={atHome} />
        {atHome ? (
          <span className="app-bar-divider" aria-hidden />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
        )}
        <BoardPanel
          boards={boards}
          activeBoard={activeBoard}
          atHome={atHome}
          onOpen={onSwitch}
          onCreate={onCreate}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onExport={onExport}
          onImport={onImport}
        />
      </nav>

      <div className="app-bar pointer-events-auto flex shrink-0 items-center gap-0.5 p-1">
        {atHome ? (
          <>
            <Link href="/topics/" className="app-bar-link">
              <BookOpen className="size-4" />
              <span className="max-sm:hidden">トピック</span>図鑑
            </Link>
            <Link href="/guide/" className="app-bar-link max-sm:hidden">
              使い方
            </Link>
            <span className="app-bar-divider" aria-hidden />
          </>
        ) : (
          <>
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
            <span className="app-bar-divider" aria-hidden />
            <Tip label="視聴者といっしょに見るリンクを作る">
              <Button size="icon-sm" variant="ghost" aria-label="いっしょに見るリンク" onClick={onShare} disabled={!hasNodes}>
                <Share2 />
              </Button>
            </Tip>
            <Tip label="X でシェア">
              <Button size="icon-sm" variant="ghost" aria-label="X でシェア" onClick={onPostToX} disabled={!hasNodes}>
                <XLogo className="size-3.5" />
              </Button>
            </Tip>
          </>
        )}
        <SettingsSheet settings={settings} onPatch={onPatchSettings} />
      </div>
    </header>
  );
}
