"use client";

import { useState } from "react";

import { AppToolbar } from "@/components/app-toolbar";
import { BoardActionsProvider } from "@/components/board-actions";
import { BoardCanvas } from "@/components/board-canvas";
import { LiveChatDock } from "@/components/live-chat-dock";
import { PinBanner } from "@/components/pin-banner";
import { StartScreen } from "@/components/start-screen";
import { useBoardController } from "@/hooks/use-board-controller";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { cellCode } from "@/lib/mandala-ids";

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
      if (!atHome) void controller.startRandom();
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
  const pinnedLabel = board.pinnedNodeId
    ? board.nodes.find((node) => node.id === board.pinnedNodeId)?.data.label ?? ""
    : "";

  return (
    <BoardActionsProvider
      value={{
        expandNode: (id) => void controller.expandNode(id),
        regenerateNode: (id) => void controller.regenerateNode(id),
        pinNode: controller.pinNode,
        setMemo: controller.setMemo,
        setLabel: controller.setLabel,
        copyLabel: (id) => void controller.copyLabel(id),
        toggleHeart: controller.toggleHeart,
        pinnedNodeId: board.pinnedNodeId,
        focusedNodeId: board.focusedNodeId,
        generationLayout: settings.generationLayout,
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
          atHome={showHome}
          canUndo={controller.undoStack.length > 0}
          canRedo={controller.redoStack.length > 0}
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
          onRename={controller.renameBoard}
          onDelete={controller.deleteBoard}
          onDuplicate={(id) => {
            setAtHome(false);
            controller.duplicateBoard(id);
          }}
          onExport={controller.exportJson}
          onImport={(text) => {
            setAtHome(false);
            controller.importJson(text);
          }}
          onUndo={controller.undo}
          onRedo={controller.redo}
          onShare={() => void controller.publishWatchLink()}
          onPatchSettings={controller.patchSettings}
        />

        {showHome ? (
          <StartScreen
            boards={controller.snapshot?.boards ?? [board]}
            activeBoardId={board.id}
            onOpenBoard={(id) => {
              setAtHome(false);
              if (id !== board.id) controller.switchBoard(id);
            }}
            onStart={(keyword) => {
              setAtHome(false);
              void controller.startWithKeyword(keyword);
            }}
            onImport={(catalog) => {
              setAtHome(false);
              controller.importCatalogBoard(catalog);
            }}
            busy={controller.busy}
            linkedUrl={settings.streamUrl}
            linkedTitle={board.name}
            linkedStreamer={settings.nickname}
            linkedWatchId={controller.shareId ?? undefined}
          />
        ) : (
          <>
            <LiveChatDock
              board={board}
              streamUrl={settings.streamUrl}
              youtubeApiKey={settings.youtubeApiKey}
              showComments={settings.showComments}
              pinnedCode={
                board.pinnedNodeId
                  ? (() => {
                      const node = board.nodes.find((item) => item.id === board.pinnedNodeId);
                      return node && typeof node.data.groupId === "number" && typeof node.data.cellIndex === "number"
                        ? cellCode(node.data.groupId, node.data.cellIndex)
                        : "";
                    })()
                  : ""
              }
              onHeart={(id) => controller.bumpFrameHearts(id, 1)}
              onStreamUrlChange={(streamUrl) => controller.patchSettings({ streamUrl })}
              onShowCommentsChange={(showComments) => controller.patchSettings({ showComments })}
            >
              <PinBanner label={pinnedLabel} />
              <BoardCanvas
                board={board}
                layout={settings.generationLayout}
                onFocus={controller.focusNode}
                onPositions={controller.syncPositions}
              />
            </LiveChatDock>
          </>
        )}
      </div>
    </BoardActionsProvider>
  );
}
