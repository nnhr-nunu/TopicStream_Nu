"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { BoardActionsProvider } from "@/components/board-actions";
import { BoardCanvas } from "@/components/board-canvas";
import { PinBanner } from "@/components/pin-banner";
import { useBoardController } from "@/hooks/use-board-controller";
import { useHotkeys } from "@/hooks/use-hotkeys";

export function OverlayWorkspace() {
  const searchParams = useSearchParams();
  const controller = useBoardController();
  const board = controller.activeBoard;
  const settings = controller.settings;
  const transparent =
    searchParams.get("transparent") === "1" ||
    (searchParams.get("transparent") !== "0" && (settings?.overlayTransparent ?? true));

  useEffect(() => {
    document.documentElement.classList.toggle("overlay-mode", true);
    document.documentElement.classList.toggle("overlay-transparent", transparent);
    return () => {
      document.documentElement.classList.remove("overlay-mode", "overlay-transparent");
    };
  }, [transparent]);

  useHotkeys({
    expand: () => {
      if (board?.focusedNodeId) void controller.expandNode(board.focusedNodeId);
    },
    random: () => {
      void controller.startRandom();
    },
    undo: controller.undo,
    pin: () => {
      if (board?.focusedNodeId) controller.pinNode(board.focusedNodeId);
    },
    copy: () => {
      if (board?.focusedNodeId) void controller.copyLabel(board.focusedNodeId);
    },
  });

  if (!controller.hydrated || !board || !settings) {
    return (
      <div className="flex h-full items-center justify-center text-lg text-muted-foreground">
        オーバーレイを準備中…
      </div>
    );
  }

  if (board.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-10 text-center">
        <p className="max-w-xl text-3xl font-semibold leading-snug text-foreground/90">
          まだ話題がありません。メイン画面でキーワードを置いてください。
        </p>
      </div>
    );
  }

  return (
    <BoardActionsProvider
      value={{
        expandNode: (id) => void controller.expandNode(id, false, true),
        pinNode: controller.pinNode,
        setMemo: controller.setMemo,
        setLabel: controller.setLabel,
        copyLabel: (id) => void controller.copyLabel(id),
        overlay: true,
        pinnedNodeId: board.pinnedNodeId,
        focusedNodeId: board.focusedNodeId,
        generationLayout: settings.generationLayout,
      }}
    >
      <div
        className="relative h-full w-full"
        style={
          {
            "--ts-scale": String(Math.max(settings.fontScale, 1.15)),
            "--ts-density": settings.density === "compact" ? "0.9" : "1.08",
          } as React.CSSProperties
        }
        data-layout={settings.generationLayout}
      >
        <PinBanner label={board.nodes.find((node) => node.id === board.pinnedNodeId)?.data.label ?? ""} />
        <BoardCanvas
          board={board}
          overlay
          layout={settings.generationLayout}
          onFocus={controller.focusNode}
          onPositions={controller.syncPositions}
        />
      </div>
    </BoardActionsProvider>
  );
}
