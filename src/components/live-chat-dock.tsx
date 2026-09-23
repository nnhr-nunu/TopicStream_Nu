"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ChevronUp, MessageSquareText, Radio } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { commentHeartCodes, findNodeByCode, parseChatComment } from "@/lib/chat-parse";
import { COMMENT_SCALE_MAX, COMMENT_SCALE_MIN } from "@/lib/constants";
import { emitChatHearts } from "@/lib/live-hearts";
import { emitPulse } from "@/lib/live-pulse";
import { parseStreamUrl, streamLabel } from "@/lib/stream-url";
import type { Board } from "@/lib/types";
import { cn } from "@/lib/utils";

type LiveState = {
  /** connecting: 接続中 / live: 読めている / waiting: 配信前 / error: 読めていない */
  phase: "connecting" | "live" | "waiting" | "error";
  message: string;
};

type ChatLine = {
  id: number;
  text: string;
};

export function LiveChatDock({
  board,
  streamUrl,
  pinnedCode,
  showComments,
  commentScale = 1,
  onCommentScaleChange,
  onHeart,
  onStreamUrlChange,
  onShowCommentsChange,
  children,
}: {
  board: Board | null;
  streamUrl: string;
  pinnedCode?: string;
  showComments: boolean;
  commentScale?: number;
  onCommentScaleChange?: (scale: number) => void;
  /** コメントで届いたハートをカードに +1 する。 */
  onHeart: (nodeId: string) => void;
  onStreamUrlChange: (url: string) => void;
  onShowCommentsChange: (show: boolean) => void;
  children: ReactNode;
}) {
  const streamRef = useMemo(() => parseStreamUrl(streamUrl), [streamUrl]);
  const linked = Boolean(streamRef);
  const [draft, setDraft] = useState("");
  const [log, setLog] = useState<ChatLine[]>([]);
  const [live, setLive] = useState<LiveState>({ phase: "connecting", message: "" });
  const [unread, setUnread] = useState(0);
  const seen = useRef(new Set<string>());
  const logEnd = useRef<HTMLDivElement | null>(null);
  const nextLine = useRef(1);
  const status = streamRef ? live.message : "";

  // 接続（WebSocket / ポーリング）はハートで board が変わるたびに張り直さない。最新値は ref で読む。
  const latest = useRef({ board, pinnedCode, onHeart, showComments });
  useEffect(() => {
    latest.current = { board, pinnedCode, onHeart, showComments };
  });

  const applyText = useCallback((text: string) => {
    const { board: current, pinnedCode: pinned, onHeart: heart } = latest.current;
    if (!current) return;
    const parsed = parseChatComment(text, pinned ?? "");
    if (parsed.highlightCodes.length > 0) emitPulse(parsed.highlightCodes);
    const hit: string[] = [];
    for (const code of commentHeartCodes(parsed)) {
      const node = findNodeByCode(current.nodes, code);
      if (!node) continue;
      heart(node.id);
      hit.push(code);
    }
    emitChatHearts(hit, 1);
    setLog((lines) => [...lines, { id: nextLine.current++, text }].slice(-80));
    if (!latest.current.showComments) setUnread((count) => count + 1);
  }, []);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "end" });
  }, [log, showComments]);

  useEffect(() => {
    const ref = parseStreamUrl(streamUrl);
    if (!ref) return;
    let cancelled = false;
    let timer: number | undefined;
    const later = (fn: () => void, ms: number) => {
      if (!cancelled) timer = window.setTimeout(fn, ms);
    };
    // 前の配信の状態を残さない
    queueMicrotask(() => {
      if (!cancelled) setLive({ phase: "connecting", message: `${streamLabel(ref)} に接続しています…` });
    });

    if (ref.kind === "twitch") {
      let ws: WebSocket | null = null;
      const connect = () => {
        ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
        const nick = `justinfan${Math.floor(10000 + Math.random() * 80000)}`;
        ws.onopen = () => {
          ws?.send("PASS SCHMOOPIIESS");
          ws?.send(`NICK ${nick}`);
          ws?.send(`JOIN #${ref.channel.toLowerCase()}`);
        };
        ws.onmessage = (event) => {
          const raw = String(event.data);
          if (raw.startsWith("PING")) {
            ws?.send("PONG :tmi.twitch.tv");
            return;
          }
          if (/ JOIN #/.test(raw) || / 366 /.test(raw)) {
            setLive({ phase: "live", message: `Twitch #${ref.channel} のチャットを読んでいます。` });
          }
          const match = raw.match(/PRIVMSG #[^ ]+ :(.+)/);
          if (match?.[1]) applyText(match[1].trim());
        };
        ws.onclose = () => {
          if (cancelled) return;
          setLive({ phase: "error", message: "Twitch との接続が切れました。自動でつなぎ直します…" });
          later(connect, 5_000);
        };
      };
      connect();
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
        ws?.close();
      };
    }

    let token = "";
    let liveChatId = "";
    const poll = async () => {
      try {
        const response = await fetch("/api/chat/youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: streamUrl, pageToken: token || undefined, liveChatId: liveChatId || undefined }),
        });
        if (cancelled) return;
        if (!response.ok) {
          // GitHub Pages（静的な公開版）にはサーバーが無い
          setLive({ phase: "error", message: "この公開版では YouTube のチャットを読めません。テストコメントで試せます。" });
          return;
        }
        const json = (await response.json()) as {
          messages?: { id: string; text: string }[];
          nextPageToken?: string;
          liveChatId?: string;
          pollingMs?: number;
          problem?: string;
          warning?: string;
          retryMs?: number;
        };
        liveChatId = json.liveChatId ?? "";
        if (json.problem) {
          token = "";
          setLive({ phase: json.problem === "not-live" ? "waiting" : "error", message: json.warning ?? "" });
          later(() => void poll(), json.retryMs ?? 20_000);
          return;
        }
        setLive({ phase: "live", message: "YouTube のチャットを読んでいます。" });
        token = json.nextPageToken ?? token;
        for (const message of json.messages ?? []) {
          if (!message.id || seen.current.has(message.id)) continue;
          seen.current.add(message.id);
          applyText(message.text);
        }
        later(() => void poll(), json.pollingMs ?? 8_000);
      } catch {
        if (cancelled) return;
        setLive({ phase: "error", message: "YouTube に届きません。少しして読み直します。" });
        later(() => void poll(), 20_000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [applyText, streamUrl]);

  const linkedLabel = !streamRef
    ? "配信と連携"
    : live.phase === "live"
      ? `${streamLabel(streamRef)} 読み込み中`
      : live.phase === "waiting"
        ? `${streamLabel(streamRef)} 配信待ち`
        : live.phase === "error"
          ? `${streamLabel(streamRef)} 読めていません`
          : `${streamLabel(streamRef)} 接続中…`;

  return (
    <div className="map-live-shell">
      <div className="map-live-row">
        {showComments ? (
          <aside
            className="comment-overlay"
            aria-label="コメント"
            style={{ ["--comment-scale" as string]: String(commentScale) }}
          >
            <div className="comment-overlay-head">
              <p className="comment-overlay-title">
                コメント{log.length > 0 ? <span className="comment-overlay-count">{log.length}</span> : null}
              </p>
              {onCommentScaleChange ? (
                <div className="comment-size" role="group" aria-label="コメントの文字の大きさ">
                  <button
                    type="button"
                    aria-label="文字を小さく"
                    title="文字を小さく"
                    disabled={commentScale <= COMMENT_SCALE_MIN}
                    onClick={() => onCommentScaleChange(Math.max(COMMENT_SCALE_MIN, Math.round((commentScale - 0.2) * 10) / 10))}
                  >
                    A−
                  </button>
                  <button
                    type="button"
                    aria-label="文字を大きく"
                    title="文字を大きく"
                    disabled={commentScale >= COMMENT_SCALE_MAX}
                    onClick={() => onCommentScaleChange(Math.min(COMMENT_SCALE_MAX, Math.round((commentScale + 0.2) * 10) / 10))}
                  >
                    A＋
                  </button>
                </div>
              ) : null}
            </div>
            <div className="comment-overlay-log">
              {log.length === 0 ? (
                <p className="comment-overlay-empty">
                  {status || "まだありません。配信と連携するか、下のテストコメントで試せます。"}
                </p>
              ) : (
                <ul>
                  {log.map((line) => (
                    <li key={line.id}>{line.text}</li>
                  ))}
                </ul>
              )}
              <div ref={logEnd} />
            </div>
          </aside>
        ) : null}
        <div className="map-live-canvas">{children}</div>
      </div>

      <div className="map-bottom-bar">
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                className={cn("map-link-pill", linked && `map-link-pill-on map-link-${live.phase}`)}
                title={status || undefined}
                aria-label={`配信との連携: ${linkedLabel}（URLを設定）`}
              />
            }
          >
            <span className="map-link-dot" aria-hidden />
            <Radio className="size-3.5" aria-hidden />
            <span className="truncate">{linkedLabel}</span>
            <ChevronUp className="size-3 opacity-60" aria-hidden />
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-[min(92vw,24rem)] gap-2 p-3">
            <label className="text-xs font-semibold" htmlFor="map-stream-url">
              配信URL
            </label>
            <Input
              id="map-stream-url"
              value={streamUrl}
              placeholder="YouTube の watch / Studio / チャット、または Twitch"
              onChange={(event) => {
                const next = event.target.value;
                if (!linked && parseStreamUrl(next) && !showComments) onShowCommentsChange(true);
                onStreamUrlChange(next);
              }}
              aria-label="配信URLまたはチャットURL"
              autoFocus
            />
            <p className="text-[11px] leading-4 text-muted-foreground">
              貼るとコメントを読み始めます。視聴者が「1E」「1E ❤」と書くと、そのカードが光ってハートが付きます。
            </p>
            {status ? <p className="map-link-status">{status}</p> : null}
            {streamUrl ? (
              <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => onStreamUrlChange("")}>
                連携をやめる
              </Button>
            ) : null}
          </PopoverContent>
        </Popover>

        <button
          type="button"
          className={cn("map-comment-toggle", showComments && "map-comment-toggle-on")}
          aria-pressed={showComments}
          onClick={() => {
            if (!showComments) setUnread(0);
            onShowCommentsChange(!showComments);
          }}
        >
          <MessageSquareText className="size-3.5" aria-hidden />
          コメント欄
          {!showComments && unread > 0 ? <span className="map-comment-unread">{unread > 99 ? "99+" : unread}</span> : null}
        </button>

        <form
          className="map-test-comment"
          onSubmit={(event) => {
            event.preventDefault();
            const text = draft.trim();
            if (!text) return;
            applyText(text);
            setDraft("");
          }}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="テストコメント（例: 1E ❤）"
            aria-label="テストコメント"
            className="h-8 bg-background/90 text-xs"
          />
          <Button type="submit" size="sm" variant="secondary" className="h-8 shrink-0" disabled={!draft.trim()}>
            送る
          </Button>
        </form>
      </div>
    </div>
  );
}
