"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findNodeByCode, parseChatComment } from "@/lib/chat-parse";
import { emitPulse } from "@/lib/live-pulse";
import { parseStreamUrl } from "@/lib/stream-url";
import type { Board } from "@/lib/types";

export function LiveChatDock({
  board,
  streamUrl,
  youtubeApiKey,
  pinnedCode,
  onHeart,
  compact = false,
}: {
  board: Board | null;
  streamUrl: string;
  youtubeApiKey?: string;
  pinnedCode?: string;
  onHeart: (nodeId: string) => void;
  compact?: boolean;
}) {
  const idleStatus = useMemo(() => {
    const ref = parseStreamUrl(streamUrl);
    if (!ref) return "配信URLは設定に貼れます。キーなしなら下のテストコメントで十分です";
    if (ref.kind === "twitch") return `Twitch #${ref.channel} のチャットを読んでいます`;
    return "YouTubeチャットを試しています（キーが必要）";
  }, [streamUrl]);
  const [draft, setDraft] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [status, setStatus] = useState(idleStatus);
  const seen = useRef(new Set<string>());

  const applyText = useCallback(
    (text: string) => {
      if (!board) return;
      const parsed = parseChatComment(text, pinnedCode ?? "");
      if (parsed.highlightCodes.length > 0) emitPulse(parsed.highlightCodes);
      for (const code of parsed.heartCodes) {
        const node = findNodeByCode(board.nodes, code);
        if (node) onHeart(node.id);
      }
      setLog((current) => [text, ...current].slice(0, 4));
    },
    [board, onHeart, pinnedCode],
  );

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
      ws.onerror = () => setStatus("Twitchに繋がらなかったので、テストコメントを使ってください");
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
          setStatus("PagesではYouTubeキーなし。テストコメントで 3E を試せます");
          return;
        }
        const json = (await response.json()) as {
          messages?: { id: string; text: string }[];
          nextPageToken?: string;
          pollingMs?: number;
          warning?: string;
        };
        if (json.warning) setStatus(json.warning);
        else setStatus("YouTubeのコメントをマップに載せています");
        token = json.nextPageToken ?? token;
        for (const message of json.messages ?? []) {
          if (!message.id || seen.current.has(message.id)) continue;
          seen.current.add(message.id);
          applyText(message.text);
        }
        if (!cancelled) window.setTimeout(() => void poll(), json.pollingMs ?? 6000);
      } catch {
        if (!cancelled) setStatus("YouTubeに届きません。テストコメントが使えます");
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [applyText, streamUrl, youtubeApiKey]);

  if (compact) return null;

  return (
    <div className="live-chat-dock pointer-events-auto">
      <p className="mb-1 text-[10px] leading-4 text-muted-foreground">{status || idleStatus}</p>
      <form
        className="flex gap-1"
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
          placeholder="テストコメント（例: 3Eが聞きたい）"
          aria-label="テストコメント"
          className="h-9 bg-background/90 text-xs"
        />
        <Button type="submit" size="sm" className="h-9 shrink-0">
          送る
        </Button>
      </form>
      {log.length > 0 ? (
        <ul className="mt-1 max-h-16 overflow-hidden text-[10px] text-muted-foreground">
          {log.map((line, index) => (
            <li key={`${index}-${line}`} className="truncate">
              {line}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
