"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ChevronUp, CircleHelp, MessageSquareText, Radio } from "lucide-react";
import { toast } from "sonner";

import { ListenerTopicColumn, ListenerTopicPill } from "@/components/listener-topic-box";
import { TimestampCopyButton } from "@/components/talk-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { copyViewerGuide, ViewerGuide } from "@/components/viewer-guide";
import { addListenerTopic, removeListenerTopic, useListenerTopics } from "@/hooks/use-listener-topics";
import { useSettled } from "@/hooks/use-settled";
import { commentHeartCodes, findNodeByCode, parseChatComment } from "@/lib/chat-parse";
import { COMMENT_SCALE_MAX, COMMENT_SCALE_MIN } from "@/lib/constants";
import { timeoutSignal } from "@/lib/api-base";
import { emitChatHearts } from "@/lib/live-hearts";
import { emitPulse } from "@/lib/live-pulse";
import { parseListenerTopic, type ListenerTopic } from "@/lib/listener-topics";
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
  /** お題箱に入ったコメント */
  topic?: boolean;
};

/** 読み始めたときの案内を出した配信（ホームへ戻ってまた開いても、同じ配信では出し直さない） */
const announcedStreams = new Set<string>();

function announce(url: string) {
  if (announcedStreams.has(url)) return;
  announcedStreams.add(url);
  toast.success("コメントを読み始めました", {
    description: "視聴者ができることは、コメント欄の ? にあります。",
    duration: 10_000,
    action: { label: "案内をコピー", onClick: () => void copyViewerGuide() },
  });
}

export function LiveChatDock({
  board,
  streamUrl,
  pinnedCode,
  showComments,
  commentScale = 1,
  onCommentScaleChange,
  onHeart,
  onAdoptTopic,
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
  /** コメントのハート。届いた分をまとめて、カードごとに数を足す */
  onHeart: (nodeId: string, delta: number) => void;
  /** お題箱のお題を押した: カードにして広げ、NOW にする */
  onAdoptTopic: (label: string) => void;
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
  const { topics } = useListenerTopics();
  const adoptTopic = (topic: ListenerTopic) => {
    removeListenerTopic(topic.key);
    onAdoptTopic(topic.label);
  };

  // 接続（WebSocket / ポーリング）はハートで board が変わるたびに張り直さない。最新値は ref で読む。
  const latest = useRef({ board, pinnedCode, onHeart, showComments });
  useEffect(() => {
    latest.current = { board, pinnedCode, onHeart, showComments };
  });

  // ハートはコメント 1 件ごとに保存せず、少しまとめてから足す（1 回の読み込みで数十件届くと、保存の繰り返しで画面が固まる）
  const pendingHearts = useRef(new Map<string, number>());
  const heartTimer = useRef<number | undefined>(undefined);
  const flushHearts = useCallback(() => {
    heartTimer.current = undefined;
    const pending = pendingHearts.current;
    pendingHearts.current = new Map();
    for (const [nodeId, count] of pending) latest.current.onHeart(nodeId, count);
  }, []);
  useEffect(
    () => () => {
      if (heartTimer.current !== undefined) window.clearTimeout(heartTimer.current);
    },
    [],
  );

  const applyText = useCallback((text: string) => {
    const { board: current, pinnedCode: pinned } = latest.current;
    if (!current) return;
    const addLine = (line: Omit<ChatLine, "id">) => {
      setLog((lines) => [...lines, { id: nextLine.current++, ...line }].slice(-80));
      if (!latest.current.showComments) setUnread((count) => count + 1);
    };
    // お題のコメントは番号・ハートとしては数えない（「お題:2Dアニメ」でカードを光らせない）
    const listener = parseListenerTopic(text);
    if (listener) {
      if (listener.topic) addListenerTopic(listener.topic);
      addLine({ text, topic: Boolean(listener.topic) });
      return;
    }
    const parsed = parseChatComment(text, pinned ?? "");
    // 「3Dゲーム」のような語を拾っても、盤面に無い番号は光らせない
    const onBoard = parsed.highlightCodes.filter((code) => findNodeByCode(current.nodes, code));
    if (onBoard.length > 0) emitPulse(onBoard);
    const hit: string[] = [];
    for (const code of commentHeartCodes(parsed)) {
      const node = findNodeByCode(current.nodes, code);
      if (!node) continue;
      pendingHearts.current.set(node.id, (pendingHearts.current.get(node.id) ?? 0) + 1);
      hit.push(code);
    }
    if (hit.length > 0 && heartTimer.current === undefined) heartTimer.current = window.setTimeout(flushHearts, 400);
    emitChatHearts(hit, 1);
    addLine({ text });
  }, [flushHearts]);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "end" });
  }, [log, showComments]);

  // URL 欄の入力途中（twitch.tv/n → /nu → …）で毎回つなぎ直さない
  const connectUrl = useSettled(streamUrl, 700);

  useEffect(() => {
    const ref = parseStreamUrl(connectUrl);
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
          // 1 回の受信に複数のコメント（と PING）が改行区切りで入ってくる
          for (const line of String(event.data).split(/\r?\n/)) {
            if (!line) continue;
            if (line.startsWith("PING")) {
              ws?.send("PONG :tmi.twitch.tv");
              continue;
            }
            if (/ JOIN #/.test(line) || / 366 /.test(line)) {
              setLive({ phase: "live", message: `Twitch #${ref.channel} のチャットを読んでいます。` });
              announce(connectUrl);
            }
            const match = line.match(/PRIVMSG #[^ ]+ :(.+)/);
            // /me のコメントは「\u0001ACTION 本文\u0001」で届くので、包みを外して読む
            if (match?.[1]) applyText(match[1].replace(/^\u0001ACTION /, "").replace(/\u0001$/, "").trim());
          }
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
    let quotaNoticed = false;
    // つないだ直後に届くのは過去のコメント。読み直すたびにハートを数え直さないよう、既読にするだけ
    let primed = false;
    const poll = async () => {
      try {
        const response = await fetch("/api/chat/youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: connectUrl, pageToken: token || undefined, liveChatId: liveChatId || undefined }),
          signal: timeoutSignal(15_000),
        });
        if (cancelled) return;
        if (response.status === 404 || response.status === 405) {
          // GitHub Pages（静的な公開版）にはサーバーが無い
          setLive({ phase: "error", message: "この公開版では YouTube のチャットを読めません。テストコメントで試せます。" });
          return;
        }
        if (!response.ok) {
          setLive({ phase: "error", message: "YouTube のチャットを読めませんでした。少しして読み直します。" });
          later(() => void poll(), response.status === 429 ? 60_000 : 20_000);
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
        if (cancelled) return;
        liveChatId = json.liveChatId ?? "";
        if (json.problem) {
          token = "";
          if (json.problem === "quota" && !quotaNoticed) {
            quotaNoticed = true;
            toast.warning(json.warning ?? "YouTube のコメント取得が今日の上限に達しました。", { duration: 10_000 });
          }
          setLive({ phase: json.problem === "not-live" ? "waiting" : "error", message: json.warning ?? "" });
          // 終わった配信は戻ってこないので、みんなの YouTube の枠を使わないよう間隔を空ける
          later(() => void poll(), json.problem === "ended" ? Math.max(json.retryMs ?? 0, 10 * 60_000) : (json.retryMs ?? 20_000));
          return;
        }
        setLive({ phase: "live", message: "YouTube のチャットを読んでいます。" });
        announce(connectUrl);
        token = json.nextPageToken ?? token;
        if (seen.current.size > 5_000) seen.current = new Set([...seen.current].slice(-1_000));
        for (const message of json.messages ?? []) {
          if (!message.id || seen.current.has(message.id)) continue;
          seen.current.add(message.id);
          if (primed) applyText(message.text);
        }
        primed = true;
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
  }, [applyText, connectUrl]);

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
              <Popover>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className="comment-help"
                      aria-label="視聴者がコメントでできること"
                      title="視聴者がコメントでできること"
                    />
                  }
                >
                  <CircleHelp className="size-3.5" aria-hidden />
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" className="w-[min(92vw,20rem)] gap-2 p-3">
                  <p className="text-xs font-semibold">視聴者ができること</p>
                  <ViewerGuide />
                  <Button type="button" size="sm" variant="secondary" className="self-start" onClick={() => void copyViewerGuide()}>
                    視聴者への案内をコピー
                  </Button>
                </PopoverContent>
              </Popover>
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
            {/* 空のお題箱は出さない（「お題:〇〇」の案内は下のコメントの空欄にある） */}
            {topics.length > 0 ? <ListenerTopicColumn topics={topics} onAdopt={adoptTopic} /> : null}
            {streamRef && (live.phase === "error" || live.phase === "waiting") && log.length > 0 ? (
              <p className={cn("comment-overlay-status", live.phase === "error" && "comment-overlay-status-error")} role="status">
                {live.message}
              </p>
            ) : null}
            <div className="comment-overlay-log">
              {log.length === 0 ? (
                <div className="comment-overlay-empty">
                  <p>{status || "コメントはまだありません。配信と連携するか、下のテストコメントで試せます。"}</p>
                  <p className="comment-overlay-guide-title">視聴者ができること</p>
                  <ViewerGuide />
                </div>
              ) : (
                <ul>
                  {log.map((line) => (
                    <li key={line.id} className={cn(line.topic && "comment-topic")}>
                      {line.topic ? <span className="comment-topic-tag">お題</span> : null}
                      {line.text}
                    </li>
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
              // 前の配信の URL が入っていても、そのまま貼れば置き換わるように全体を選んでおく
              onFocus={(event) => event.currentTarget.select()}
              placeholder="YouTube の watch / Studio / チャット、または Twitch"
              onChange={(event) => {
                const next = event.target.value;
                if (!linked && parseStreamUrl(next) && !showComments) onShowCommentsChange(true);
                onStreamUrlChange(next);
              }}
              aria-label="配信URLまたはチャットURL"
              autoFocus
            />
            {/* 視聴者ができることの一覧はコメント欄（貼ると開く）に出るので、ここでは繰り返さない */}
            <p className="text-[11px] leading-4 text-muted-foreground">貼るとコメント欄が開いて、コメントを読み始めます。</p>
            <Button type="button" size="sm" variant="secondary" className="self-start" onClick={() => void copyViewerGuide()}>
              視聴者への案内をコピー
            </Button>
            <TimestampCopyButton />
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

        <ListenerTopicPill topics={topics} columnOpen={showComments} onAdopt={adoptTopic} />

        <form
          // スマホでは、コメント欄を開くか配信と連携するまで出さない（2 段になって盤面が狭くなるので）
          className={cn("map-test-comment", !showComments && !linked && "map-test-comment-idle")}
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
            placeholder="テストコメント（例: 1E / ❤ / お題:夏）"
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
