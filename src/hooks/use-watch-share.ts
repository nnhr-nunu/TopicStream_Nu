"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { currentSnapshot } from "@/lib/board-controller-helpers";
import { loadIdentity } from "@/lib/identity";
import { parseStreamUrl } from "@/lib/stream-url";
import { withoutMemos } from "@/lib/storage";
import type { Board } from "@/lib/types";

const SHARE_KEY = "topicstream-nu:share-id";
/** いっしょに見るリンクを書き換えるための鍵（作ったタブだけが持つ） */
const SHARE_OWNER_KEY = "topicstream-nu:share-key";

export function readShareSession(): { id: string | null; key: string | null } {
  try {
    return { id: window.sessionStorage.getItem(SHARE_KEY), key: window.sessionStorage.getItem(SHARE_OWNER_KEY) };
  } catch {
    return { id: null, key: null };
  }
}

function watchLink(id: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${window.location.origin}${base}/watch?id=${encodeURIComponent(id)}`;
}

/** このタブで作ったいっしょに見るリンク（まだ作っていなければ null） */
export function watchLinkFromSession(): string | null {
  const id = readShareSession().id;
  return id ? watchLink(id) : null;
}

function writeShareSession(value: { id: string; key: string } | null) {
  try {
    if (value) {
      window.sessionStorage.setItem(SHARE_KEY, value.id);
      window.sessionStorage.setItem(SHARE_OWNER_KEY, value.key);
    } else {
      window.sessionStorage.removeItem(SHARE_KEY);
      window.sessionStorage.removeItem(SHARE_OWNER_KEY);
    }
  } catch {
    /* 残せなくても、このページを開いている間は共有を続けられる */
  }
}

/** 共有ボードを送る。forbidden はリンクの持ち主ではない（別の端末・鍵が無い） */
async function postShare(
  share: { id: string | null; key: string | null },
  board: Board,
  nickname: string,
  /** 配信のコメントを読んでいるか（見る画面に、コメントでできることを出す） */
  chat: boolean,
): Promise<{ id: string; key: string } | "forbidden" | null> {
  const response = await fetch("/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: share.id ?? undefined, key: share.key ?? undefined, board: withoutMemos(board), nickname, chat }),
  }).catch(() => null);
  if (response?.status === 403) return "forbidden";
  if (!response?.ok) return null;
  const json = (await response.json().catch(() => null)) as { id?: unknown; key?: unknown } | null;
  return typeof json?.id === "string" && typeof json.key === "string" ? { id: json.id, key: json.key } : null;
}

/**
 * 「いっしょに見るリンク」。リンクを作って（publishWatchLink）、以後は今のボードが変わるたびに同じリンクへ送り直す。
 * リンクの持ち主かどうかは、作ったタブだけが持つ鍵で見分ける。
 */
export function useWatchShare(activeBoard: Board | null, streamUrl = "") {
  const [shareId, setShareId] = useState<string | null>(null);
  /** リンクを作っている途中（続けて押しても 2 つ作らない） */
  const publishing = useRef(false);
  /** 最後に送った時刻（盤面が絶えず変わっていても、間をあけすぎずに送る） */
  const lastSent = useRef(0);
  const chat = Boolean(parseStreamUrl(streamUrl));

  const publishWatchLink = useCallback(async () => {
    if (publishing.current) return;
    const current = currentSnapshot();
    const board = current.boards.find((item) => item.id === current.activeBoardId);
    if (!board || board.nodes.length === 0) {
      toast.error("共有する話題がまだありません");
      return;
    }
    const nickname = current.settings.nickname || loadIdentity().nickname;
    const chatNow = Boolean(parseStreamUrl(current.settings.streamUrl));
    const session = readShareSession();
    publishing.current = true;
    let saved: Awaited<ReturnType<typeof postShare>>;
    try {
      saved = await postShare({ id: shareId ?? session.id, key: session.key }, board, nickname, chatNow);
      // 書き換えられないリンク（別のタブで作った等）なら、新しいリンクを作り直す
      if (saved === "forbidden") saved = await postShare({ id: null, key: null }, board, nickname, chatNow);
    } finally {
      publishing.current = false;
    }
    if (!saved || saved === "forbidden") {
      toast.error("いっしょに見るリンクを作れませんでした");
      return;
    }
    setShareId(saved.id);
    writeShareSession(saved);
    const url = watchLink(saved.id);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("いっしょに見るリンクをコピーしました", {
        description: "リンクを知っている人はボードを見られます。個人情報は書かないでください。",
      });
    } catch {
      // コピーできない環境（権限が無い・古いブラウザ）では、リンクを読める形で長めに出す
      toast.message("いっしょに見るリンクを作りました（自動でコピーできなかったので、下のリンクを手でコピーしてください）", {
        description: url,
        duration: 20_000,
      });
    }
  }, [shareId]);

  // 再読み込みしても共有を続ける（下の自動送信でサーバー側が消えていても載せ直す）
  useEffect(() => {
    const saved = readShareSession().id;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage はマウント後にしか読めない
    if (saved) setShareId(saved);
  }, []);

  useEffect(() => {
    if (!shareId || !activeBoard || activeBoard.nodes.length === 0) return;
    // 少しまとめてから送る。ただしコメントのハートが絶えず届いて盤面が変わり続けても、2.5 秒に 1 回は送る
    const wait = Math.max(0, Math.min(900, lastSent.current + 2_500 - Date.now()));
    const timer = window.setTimeout(() => {
      lastSent.current = Date.now();
      const current = currentSnapshot();
      const nickname = current.settings.nickname || loadIdentity().nickname;
      void postShare({ id: shareId, key: readShareSession().key }, activeBoard, nickname, chat).then((saved) => {
        if (saved === "forbidden") {
          // 別の端末で作ったリンクなど。黙って送り続けず、作り直してもらう
          writeShareSession(null);
          setShareId(null);
          toast.message("いっしょに見るリンクの更新を止めました", {
            description: "右上の「いっしょに見るリンク」ボタンから、作り直してください。",
          });
        } else if (saved) {
          writeShareSession(saved);
        }
      });
    }, wait);
    return () => window.clearTimeout(timer);
  }, [activeBoard, shareId, chat]);

  return { shareId, publishWatchLink };
}
