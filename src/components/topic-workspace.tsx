"use client";

import { useEffect, useState } from "react";

import { AppToolbar } from "@/components/app-toolbar";
import { BoardActionsProvider } from "@/components/board-actions";
import { BoardCanvas } from "@/components/board-canvas";
import { LiveChatDock } from "@/components/live-chat-dock";
import { ModeDock } from "@/components/mode-dock";
import { PinBanner } from "@/components/pin-banner";
import { PrivacyNotice } from "@/components/privacy-notice";
import { SharePostDialog } from "@/components/share-post-dialog";
import { StartScreen } from "@/components/start-screen";
import { useBoardController } from "@/hooks/use-board-controller";
import { useCommunityPublish } from "@/hooks/use-community-publish";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { spareCount } from "@/lib/board-spares";
import {
  clearOpenActiveBoardRequest,
  hasStartKeywordRequest,
  isOpenActiveBoardRequested,
  takeStartKeywordRequest,
} from "@/lib/board-store";
import { fetchExplanation } from "@/lib/explain-client";
import { cellCode } from "@/lib/mandala-ids";
import { DEFAULT_MODE } from "@/lib/modes";
import { topicContext } from "@/lib/topic-context";

/** 履歴に積んだ「マップを開いている」の印 */
const BOARD_HISTORY_KEY = "tsBoard";

export function TopicWorkspace() {
  const controller = useBoardController();
  const board = controller.activeBoard;
  const settings = controller.settings;
  const focusedId = board?.focusedNodeId ?? board?.pinnedNodeId ?? null;
  // サイトに来たときはホームから。図鑑などでボードを作って戻ってきたときだけマップを直接開く
  const [atHome, setAtHome] = useState(() => !isOpenActiveBoardRequested());
  useEffect(() => clearOpenActiveBoardRequest(), []);
  // 別ページの「このお題で始める」から来たときは、始めるのと同時に注意書きを出す
  const [privacyNotice, setPrivacyNotice] = useState(() => (hasStartKeywordRequest() ? 1 : 0));
  // X シェアの画面。開くたびに key を変えて、最新のボードで文例を作り直す。
  // ボード一覧からは表示中でないボードもシェアできるので、対象のボードを覚えておく
  const [sharePostOpen, setSharePostOpen] = useState(false);
  const [sharePostKey, setSharePostKey] = useState(0);
  const [sharePostBoardId, setSharePostBoardId] = useState<string | null>(null);
  const openSharePost = (id: string | null) => {
    setSharePostBoardId(id);
    setSharePostKey((key) => key + 1);
    setSharePostOpen(true);
  };
  const notifyPrivacy = () => setPrivacyNotice((value) => value + 1);

  // 別ページ（みんなが作った話題マップ）の「このお題で始める」から来たら、ボードを読み込んでから始める
  const { hydrated, startWithKeyword } = controller;
  useEffect(() => {
    if (!hydrated) return;
    const keyword = takeStartKeywordRequest();
    if (keyword) void startWithKeyword(keyword, DEFAULT_MODE);
  }, [hydrated, startWithKeyword]);

  useCommunityPublish(board ?? null, settings?.streamUrl ?? "", controller.shareId ?? undefined);

  // ホーム画面の裏にあるボードをキーで動かさない
  const onBoard = Boolean(controller.hydrated && board && !atHome && board.nodes.length > 0);

  // マップを開いたら履歴を1つ積み、ブラウザの「戻る」でホームへ戻す（図鑑から来たときも、図鑑ではなくホームへ）
  useEffect(() => {
    // 開き直したとき、前の印が残っていると「戻る」でサイトの外へ出てしまうので消す
    if (window.history.state?.[BOARD_HISTORY_KEY]) {
      window.history.replaceState({ ...window.history.state, [BOARD_HISTORY_KEY]: false }, "");
    }
    const onPopState = (event: PopStateEvent) => setAtHome(!event.state?.[BOARD_HISTORY_KEY]);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    if (!onBoard || window.history.state?.[BOARD_HISTORY_KEY]) return;
    window.history.pushState({ ...window.history.state, [BOARD_HISTORY_KEY]: true }, "");
  }, [onBoard]);
  const goHome = () => {
    if (window.history.state?.[BOARD_HISTORY_KEY]) window.history.back();
    else setAtHome(true);
  };
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
    roulette: () => void controller.spinRoulette(),
  }, onBoard);

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
        detailNode: controller.detailNode,
        rejectNode: controller.rejectNode,
        explainNode: (id, label) =>
          fetchExplanation({
            label,
            context: topicContext(board, id),
            mode: board.mode,
            apiKey: settings.geminiApiKey,
            model: settings.geminiModel,
          }),
        pinNode: controller.pinNode,
        setMemo: controller.setMemo,
        setLabel: controller.setLabel,
        copyLabel: (id) => void controller.copyLabel(id),
        toggleHeart: controller.toggleHeart,
        pinnedNodeId: board.pinnedNodeId,
        focusedNodeId: board.focusedNodeId,
        regeneratingIds: controller.regeneratingIds,
        regenReadyAt: controller.regenReadyAt,
        spareCountFor: (id) => spareCount(board, board.nodes.find((node) => node.id === id)?.data.parentId),
        generationLayout: settings.generationLayout,
        expandMode: settings.expandMode,
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
          onHome={goHome}
          onSwitch={(id) => {
            setAtHome(false);
            controller.switchBoard(id);
          }}
          onRename={controller.renameBoard}
          onDelete={controller.deleteBoard}
          onExport={controller.exportJson}
          onImport={(text) => {
            if (controller.importJson(text)) setAtHome(false);
          }}
          onUndo={controller.undo}
          onRedo={controller.redo}
          onShare={() => void controller.publishWatchLink()}
          onPostToX={() => openSharePost(null)}
          onShareBoard={(id) => openSharePost(id)}
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
            onStart={(keyword, mode) => {
              notifyPrivacy();
              setAtHome(false);
              void controller.startWithKeyword(keyword, mode);
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
              showComments={settings.showComments}
              commentScale={settings.commentScale}
              onCommentScaleChange={(commentScale) => controller.patchSettings({ commentScale })}
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
              <PinBanner label={pinnedLabel} since={settings.showElapsed ? board.pinnedAt : undefined} />
              <BoardCanvas
                board={board}
                layout={settings.generationLayout}
                onFocus={controller.focusNode}
                onCombine={controller.combineNodes}
              >
                <ModeDock
                  mode={settings.expandMode}
                  onChange={(expandMode) => controller.patchSettings({ expandMode })}
                  expanded={board.nodes.length > 1}
                  onRoulette={() => void controller.spinRoulette()}
                  spinning={controller.spinning}
                />
              </BoardCanvas>
            </LiveChatDock>
          </>
        )}
      </div>
      <PrivacyNotice trigger={privacyNotice} />
      <SharePostDialog
        key={sharePostKey}
        open={sharePostOpen}
        onOpenChange={setSharePostOpen}
        board={controller.snapshot?.boards.find((item) => item.id === sharePostBoardId) ?? board}
      />
    </BoardActionsProvider>
  );
}
