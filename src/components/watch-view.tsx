"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Copy, Heart } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { BoardActionsProvider } from "@/components/board-actions";
import { BoardCanvas } from "@/components/board-canvas";
import { PinBanner } from "@/components/pin-banner";
import { Button } from "@/components/ui/button";
import { ViewerGuide } from "@/components/viewer-guide";
import { timeoutSignal } from "@/lib/api-base";
import { loadFavoriteTopics, subscribeTopicFavorites, toggleFavoriteTopic } from "@/lib/favorites";
import { layoutBoard, prefsFromSettings } from "@/lib/layout";
import type { Board, GenerationLayout } from "@/lib/types";

const NO_FAVORITES: string[] = [];
const noSubscribe = () => () => {};

/** OBS のブラウザソースで映しているか（配信の画面に「使ってみる」の入口を出さない） */
function inObs(): boolean {
  return "obsstudio" in window;
}

function layoutOf(board: Board): GenerationLayout {
  return board.nodes.some((node) => typeof node.data.groupId === "number") ? "mandala" : "radial";
}

export function WatchView({ shareId }: { shareId: string }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [nickname, setNickname] = useState("");
  /** 配信者が配信のコメントを読んでいる（見る人にコメントでできることを出す） */
  const [chat, setChat] = useState(false);
  /** まだ一度も読めないまま失敗が続いている（読み込み中のまま黙らない） */
  const [struggling, setStruggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localFocus, setLocalFocus] = useState<string | null>(null);
  // 配信者が NOW を変えたら、見る人が選んでいたカードは外して NOW を追う（「コピー」「♡ する」が古いカードのままにならないように）
  const [seenPinned, setSeenPinned] = useState<string | null | undefined>(undefined);
  if (board && board.pinnedNodeId !== seenPinned) {
    setSeenPinned(board.pinnedNodeId);
    if (seenPinned !== undefined) setLocalFocus(null);
  }
  // 配信者の文字サイズ・間隔の設定で並んだ位置のままだとカードが詰まったり離れたりするので、
  // 見る側の標準の大きさで並べ直す（メイン画面と同じ見た目にそろえる）
  const layout = board ? layoutOf(board) : "mandala";
  const laidOut = useMemo(
    () =>
      board
        ? layoutBoard(
            board,
            prefsFromSettings({ density: "comfortable", fontScale: 1, generationLayout: layoutOf(board) }, false, board.pinnedNodeId),
          )
        : null,
    [board],
  );
  const favs = useSyncExternalStore(
    subscribeTopicFavorites,
    loadFavoriteTopics,
    () => NO_FAVORITES,
  );
  // サーバーでは出さず、ブラウザで OBS でないと分かってから出す
  const obs = useSyncExternalStore(noSubscribe, inObs, () => true);

  // タブの題名もボード名にする（いくつも開いたときに見分けられるように）
  useEffect(() => {
    if (board?.name) document.title = `${board.name} | いっしょに見る - TopicStream(ぬ)`;
  }, [board?.name]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let lastUpdated = -1;
    let failures = 0;
    const failed = () => {
      failures += 1;
      if (lastUpdated < 0 && failures >= 3 && !cancelled) setStruggling(true);
    };
    async function load() {
      if (!shareId) {
        if (!cancelled) setError("リンクが途中で切れています。配信者のリンクから開き直してください。");
        return;
      }
      // 見ていないタブでは読まない・前の読み込みが終わるまで重ねない
      if (inFlight || (lastUpdated >= 0 && document.hidden)) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/share/${encodeURIComponent(shareId)}`, {
          cache: "no-store",
          signal: timeoutSignal(10_000),
        });
        if (cancelled) return;
        if (!response.ok) {
          // 一度見えていたら、一時的な失敗で盤面を消さない
          if (response.status === 404 && lastUpdated < 0) {
            setError("このリンクは見つかりません。配信者がまだ公開していないか、リンクが違うようです。");
          }
          failed();
          return;
        }
        const json = (await response.json()) as { board: Board; nickname: string; chat?: boolean };
        if (cancelled || !json.board) return;
        const updated = typeof json.board.updatedAt === "number" ? json.board.updatedAt : Date.now();
        if (updated === lastUpdated) return;
        lastUpdated = updated;
        setBoard(json.board);
        setNickname(json.nickname);
        setChat(json.chat === true);
        setError(null);
      } catch {
        // 通信の途切れは次の読み込みで取り戻す
        failed();
      } finally {
        inFlight = false;
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [shareId]);

  if (error) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="max-w-md text-sm leading-6 text-muted-foreground">{error}</p>
        <Button nativeButton={false} render={<Link href="/" />}>
          自分のマップを開く
        </Button>
      </div>
    );
  }

  if (!board || !laidOut) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
        <p>いっしょに見る画面を読み込み中…</p>
        {struggling ? <p className="text-xs">つながりにくいようです。このまま読み直しています。</p> : null}
      </div>
    );
  }

  const viewBoard = {
    ...laidOut,
    focusedNodeId: localFocus ?? board.focusedNodeId,
  };
  const focused = viewBoard.focusedNodeId ?? viewBoard.pinnedNodeId;
  const focusedLabel = viewBoard.nodes.find((node) => node.id === focused)?.data.label;

  return (
    <BoardActionsProvider
      value={{
        expandNode: () => undefined,
        focusNode: setLocalFocus,
        pinNode: () => undefined,
        setMemo: () => undefined,
        setLabel: () => undefined,
        copyLabel: async (id) => {
          const label = viewBoard.nodes.find((node) => node.id === id)?.data.label;
          if (!label) return;
          try {
            await navigator.clipboard.writeText(label);
            toast.success(`「${label}」をコピーしました`);
          } catch {
            toast.error("コピーできませんでした");
          }
        },
        overlay: true,
        viewer: true,
        pinnedNodeId: board.pinnedNodeId,
        focusedNodeId: viewBoard.focusedNodeId,
        generationLayout: layout,
      }}
    >
      <div className="relative h-svh overflow-hidden" data-layout={layout}>
        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-between gap-3 p-3">
          <div className="pointer-events-auto rounded-2xl border border-border/70 bg-background/75 px-3 py-2 backdrop-blur-md">
            <p className="text-[10px] tracking-[0.2em] text-primary">いっしょに見ている</p>
            <p className="text-sm font-medium">{board.name}</p>
            {nickname ? <p className="text-[11px] text-muted-foreground">{nickname} の枠</p> : null}
            {/* 配信者がコメントを読んでいて、カードに番号があるときだけ（番号は 3×3 のときだけ付く） */}
            {chat && !obs && layout === "mandala" ? (
              <details open className="watch-join mt-1.5 max-w-64 text-[11px]">
                <summary className="cursor-pointer font-semibold text-primary">コメントで参加できます</summary>
                <ViewerGuide />
              </details>
            ) : null}
            {obs ? null : (
              // 見ている人が、自分の配信・雑談でも使えると分かる入口（配信の画面には出さない）
              <Link href="/" className="mt-1 inline-block text-[11px] text-primary underline-offset-4 hover:underline">
                TopicStream(ぬ) で自分も話題を広げる →
              </Link>
            )}
          </div>
          <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-border/70 bg-background/75 p-1 backdrop-blur-md">
            <Button
              size="sm"
              variant="ghost"
              disabled={!focusedLabel}
              onClick={async () => {
                if (!focusedLabel) return;
                try {
                  await navigator.clipboard.writeText(focusedLabel);
                  toast.success(`「${focusedLabel}」をコピーしました`);
                } catch {
                  toast.error("コピーできませんでした");
                }
              }}
            >
              <Copy />
              コピー
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!focusedLabel}
              onClick={() => {
                if (!focusedLabel) return;
                const kept = toggleFavoriteTopic(focusedLabel).includes(focusedLabel);
                if (kept) {
                  toast.success(`「${focusedLabel}」にハートを付けました`, { description: "トピック図鑑の「♡ した話題」から、自分のマップにできます" });
                } else {
                  toast.success(`「${focusedLabel}」のハートを外しました`);
                }
              }}
            >
              <Heart className={focusedLabel && favs.includes(focusedLabel) ? "fill-current" : undefined} />
              ハート
            </Button>
          </div>
        </header>
        <PinBanner
          label={board.nodes.find((node) => node.id === board.pinnedNodeId)?.data.label ?? ""}
          fromListener={Boolean(board.nodes.find((node) => node.id === board.pinnedNodeId)?.data.fromListener)}
        />
        <BoardCanvas board={viewBoard} overlay layout={layout} onFocus={setLocalFocus} />
      </div>
    </BoardActionsProvider>
  );
}
