"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ChevronUp, MessageSquareText, Radio } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { commentHeartCodes, findNodeByCode, parseChatComment } from "@/lib/chat-parse";
import { emitChatHearts } from "@/lib/live-hearts";
import { emitPulse } from "@/lib/live-pulse";
import { parseStreamUrl, streamLabel } from "@/lib/stream-url";
import type { Board } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChatLine = {
  id: number;
  text: string;
};

export function LiveChatDock({
  board,
  streamUrl,
  youtubeApiKey,
  pinnedCode,
  showComments,
  onHeart,
  onStreamUrlChange,
  onShowCommentsChange,
  children,
}: {
  board: Board | null;
  streamUrl: string;
  youtubeApiKey?: string;
  pinnedCode?: string;
  showComments: boolean;
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
  const [liveStatus, setLiveStatus] = useState("");
  const seen = useRef(new Set<string>());
  const logEnd = useRef<HTMLDivElement | null>(null);
  const nextLine = useRef(1);
  const status = streamRef ? liveStatus : "";

  // 接続（WebSocket / ポーリング）はハートで board が変わるたびに張り直さない。最新値は ref で読む。
  const latest = useRef({ board, pinnedCode, onHeart });
  useEffect(() => {
    latest.current = { board, pinnedCode, onHeart };
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
  }, []);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "end" });
  }, [log, showComments]);

  useEffect(() => {
    const ref = parseStreamUrl(streamUrl);
    if (!ref) return;
    if (ref.kind === "twitch") {
      const ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
      const nick = `justinfan${Math.floor(10000 + Math.random() * 80000)}`;
      ws.onopen = () => {
        ws.send("PASS SCHMOOPIIESS");
        ws.send(`NICK ${nick}`);
        ws.send(`JOIN #${ref.channel.toLowerCase()}`);
        setLiveStatus("Twitch のチャットを読んでいます");
      };
      ws.onmessage = (event) => {
        const raw = String(event.data);
        if (raw.startsWith("PING")) {
          ws.send("PONG :tmi.twitch.tv");
          return;
        }
        const match = raw.match(/PRIVMSG #[^ ]+ :(.+)/);
        if (match?.[1]) applyText(match[1].trim());
      };
      ws.onerror = () => setLiveStatus("Twitchに繋がらなかったので、テストコメントを使ってください");
      return () => ws.close();
    }

    let cancelled = false;
    let token = "";
    const poll = async () => {
      try {
        const response = await fetch("/api/chat/youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: streamUrl, apiKey: youtubeApiKey, pageToken: token || undefined }),
        });
        if (cancelled) return;
        if (!response.ok) {
          setLiveStatus("PagesではYouTubeキーなし。テストコメントで 1E を試せます");
          return;
        }
        const json = (await response.json()) as {
          messages?: { id: string; text: string }[];
          nextPageToken?: string;
          pollingMs?: number;
          warning?: string;
        };
        if (json.warning) setLiveStatus(json.warning);
        else setLiveStatus("YouTubeのコメントをマップに載せています");
        token = json.nextPageToken ?? token;
        for (const message of json.messages ?? []) {
          if (!message.id || seen.current.has(message.id)) continue;
          seen.current.add(message.id);
          applyText(message.text);
        }
        if (!cancelled) window.setTimeout(() => void poll(), json.pollingMs ?? 6000);
      } catch {
        if (!cancelled) setLiveStatus("YouTubeに届きません。テストコメントが使えます");
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [applyText, streamUrl, youtubeApiKey]);

  const linkedLabel = streamRef ? `${streamLabel(streamRef)} 連携中` : "配信と連携";

  return (
    <div className="map-live-shell">
      <div className="map-live-row">
        {showComments ? (
          <aside className="comment-overlay" aria-label="コメント">
            <p className="comment-overlay-title">
              コメント{log.length > 0 ? <span className="comment-overlay-count">{log.length}</span> : null}
            </p>
            <div className="comment-overlay-log">
              {log.length === 0 ? (
                <p className="comment-overlay-empty">まだありません。配信と連携するか、下のテストコメントで試せます。</p>
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
                className={cn("map-link-pill", linked && "map-link-pill-on")}
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
              onChange={(event) => onStreamUrlChange(event.target.value)}
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
          onClick={() => onShowCommentsChange(!showComments)}
        >
          <MessageSquareText className="size-3.5" aria-hidden />
          コメント欄
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
