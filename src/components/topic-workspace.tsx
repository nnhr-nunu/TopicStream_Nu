"use client";

import { useState } from "react";

import { AppToolbar } from "@/components/app-toolbar";
import { BoardActionsProvider } from "@/components/board-actions";
import { BoardCanvas } from "@/components/board-canvas";
import { StartScreen } from "@/components/start-screen";
import { useBoardController } from "@/hooks/use-board-controller";
import { useHotkeys } from "@/hooks/use-hotkeys";

export function TopicWorkspace() {
  const controller = useBoardController();
  const board = controller.activeBoard;
  const settings = controller.settings;
  const focusedId = board?.focusedNodeId ?? board?.pinnedNodeId ?? null;
  const [atHome, setAtHome] = useState(false);

  useHotkeys({
    expand: () => {
      if (focusedId) void controller.expandNode(focusedId);
    },
    random: () => {
      setAtHome(false);
      void controller.startRandom();
    },
    undo: controller.undo,
    redo: controller.redo,
    regenerate: () => {
      if (focusedId) void controller.regenerateNode(focusedId);
    },
    pin: () => {
      if (focusedId) controller.pinNode(focusedId);
    },
    copy: () => {
      if (focusedId) void controller.copyLabel(focusedId);
    },
  });

  if (!controller.hydrated || !board || !settings) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        ボードを読み込み中…
      </div>
    );
  }

  const showHome = atHome || board.nodes.length === 0;

  return (
    <BoardActionsProvider
      value={{
        expandNode: (id) => void controller.expandNode(id),
        regenerateNode: (id) => void controller.regenerateNode(id),
        pinNode: controller.pinNode,
        setMemo: controller.setMemo,
        copyLabel: (id) => void controller.copyLabel(id),
        pinnedNodeId: board.pinnedNodeId,
        focusedNodeId: board.focusedNodeId,
      }}
    >
      <div
        className="relative flex h-svh min-h-0 flex-1 flex-col"
        style={
          {
            "--ts-scale": String(settings.fontScale),
            "--ts-density": settings.density === "compact" ? "0.82" : "1",
          } as React.CSSProperties
        }
        data-density={settings.density}
        data-layout={settings.generationLayout}
      >
        <AppToolbar
          boards={controller.snapshot?.boards ?? [board]}
          activeBoard={board}
          settings={settings}
          canUndo={controller.undoStack.length > 0}
          canRedo={controller.redoStack.length > 0}
          canRegenerate={Boolean(focusedId) && !showHome}
          hasNodes={board.nodes.length > 0}
          onHome={() => setAtHome(true)}
          onSwitch={(id) => {
            setAtHome(false);
            controller.switchBoard(id);
          }}
          onCreate={() => {
            setAtHome(true);
            controller.createBoard();
          }}
          onRename={controller.renameActive}
          onDelete={controller.deleteActive}
          onExport={controller.exportJson}
          onImport={(text) => {
            setAtHome(false);
            controller.importJson(text);
          }}
          onUndo={controller.undo}
          onRedo={controller.redo}
          onRegenerate={() => {
            if (focusedId) void controller.regenerateNode(focusedId);
          }}
          onShare={() => void controller.publishWatchLink()}
          onPatchSettings={controller.patchSettings}
        />

        {showHome ? (
          <StartScreen
            onStart={(keyword) => {
              setAtHome(false);
              void controller.startWithKeyword(keyword);
            }}
            onRandom={() => {
              setAtHome(false);
              void controller.startRandom();
            }}
            onImport={(catalog) => {
              setAtHome(false);
              controller.importCatalogBoard(catalog);
            }}
            onResume={board.nodes.length > 0 ? () => setAtHome(false) : undefined}
            busy={controller.busy}
          />
        ) : (
          <BoardCanvas
            board={board}
            onFocus={controller.focusNode}
            onPositions={controller.syncPositions}
          />
        )}
      </div>
    </BoardActionsProvider>
  );
}
