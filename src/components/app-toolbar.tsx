"use client";

import { Dices, MonitorPlay, Redo2, RefreshCw, RotateCcw, Share2, Undo2, Users } from "lucide-react";
import Link from "next/link";

import { BoardSwitcher } from "@/components/board-switcher";
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
  overlayHref,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  onExport,
  onImport,
  onRandom,
  onUndo,
  onRedo,
  onRegenerate,
  onReset,
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
  overlayHref: string;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onExport: () => void;
  onImport: (text: string) => void;
  onRandom: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRegenerate: () => void;
  onReset: () => void;
  onShare: () => void;
  onPatchSettings: (patch: Partial<Settings>) => void;
}) {
  return (
    <header className="app-chrome pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-4">
      <div className="pointer-events-auto flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-background/75 px-2 py-1.5 shadow-lg backdrop-blur-md">
        <Link href="/" className="hidden px-2 sm:block">
          <p className="text-[10px] tracking-[0.22em] text-primary">TOPICSTREAM</p>
          <p className="text-sm font-medium leading-none">Nu</p>
        </Link>
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
        <Tip label="ランダムなきっかけ (R)">
          <Button size="icon-sm" variant="ghost" aria-label="ランダムなきっかけ" onClick={onRandom}>
            <Dices />
          </Button>
        </Tip>
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
        {hasNodes ? (
          <Tip label="ボードを空にする">
            <Button size="icon-sm" variant="ghost" aria-label="ボードを空にする" onClick={onReset}>
              <RotateCcw />
            </Button>
          </Tip>
        ) : null}
        <Tip label="いっしょに見るリンク">
          <Button size="icon-sm" variant="ghost" aria-label="いっしょに見るリンク" onClick={onShare} disabled={!hasNodes}>
            <Share2 />
          </Button>
        </Tip>
        <Tip label="みんなのトークテーマ">
          <Button size="icon-sm" variant="ghost" aria-label="みんなのトークテーマ" nativeButton={false} render={<Link href="/community" />}>
            <Users />
          </Button>
        </Tip>
        <Tip label="OBSオーバーレイ">
          <Button size="icon-sm" variant="ghost" aria-label="OBSオーバーレイ" nativeButton={false} render={<Link href={overlayHref} target="_blank" />}>
            <MonitorPlay />
          </Button>
        </Tip>
        <SettingsSheet settings={settings} onPatch={onPatchSettings} />
      </div>
    </header>
  );
}
