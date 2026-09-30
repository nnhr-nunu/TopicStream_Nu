"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ClipboardList, Copy, X } from "lucide-react";
import { toast } from "sonner";

import { Section } from "@/components/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tweetIntentUrl } from "@/lib/share-post";
import { siteUrl } from "@/lib/site-url";
import {
  clockOf,
  formatOffset,
  getServerTalkLog,
  loadTalkLog,
  originFromClock,
  removeTalkRow,
  rowsFrom,
  subscribeTalkLog,
  talkDuration,
  talkPost,
  talkSessions,
  talkTimestamps,
  usesManyThemes,
  type TalkSession,
} from "@/lib/talk-log";

function sessionLabel(session: TalkSession): string {
  const date = new Date(session.start);
  return `${date.getMonth() + 1}/${date.getDate()} ${clockOf(session.start)}〜（${session.rows.length} 話題）`;
}

function minutesLabel(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  return minutes < 1 ? "1分未満" : minutes < 60 ? `${minutes}分` : `${Math.floor(minutes / 60)}時間${minutes % 60}分`;
}

async function copyText(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("コピーできませんでした");
  }
}

/**
 * 設定の「話した話題のまとめ」。NOW にした話題を、配信ごと・時刻順に並べて、
 * 概要欄のタイムスタンプや X の投稿にコピーできる（ボードを切り替えながら話しても 1 本につながる）
 */
export function TalkSummary() {
  const log = useSyncExternalStore(subscribeTalkLog, loadTalkLog, getServerTalkLog);
  const sessions = useMemo(() => talkSessions(log), [log]);
  const [selected, setSelected] = useState<string | null>(null);
  /** 配信を始めた時刻（まとまりごと。直していなければ最初の話題の時刻） */
  const [clocks, setClocks] = useState<Record<string, string>>({});
  // 話している途中の行の長さを出すための「今」
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const session = sessions.find((item) => item.id === selected) ?? sessions[0];
  if (!session) {
    return (
      <Section icon={<ClipboardList />} title="話した話題のまとめ">
        <p className="text-xs leading-5 text-muted-foreground">
          まだ記録がありません。カードを NOW（P キー・ルーレット）にすると、話した順と時刻がここに残り、概要欄のタイムスタンプや
          X の投稿にコピーできます。
        </p>
      </Section>
    );
  }

  // 時刻を直していなければ、最初の話題をちょうど 0:00 にする（時刻の欄は分までなので、秒のずれを出さない）
  const edited = clocks[session.id];
  const clock = edited ?? clockOf(session.start);
  const origin = edited === undefined ? session.start : originFromClock(session.start, edited);
  const shown = rowsFrom(session.rows, origin);
  const withTheme = usesManyThemes(shown.map((item) => item.row));
  const lastRow = session === sessions[0] ? session.rows[session.rows.length - 1] : undefined;
  const items = sessions.map((item) => ({ value: item.id, label: sessionLabel(item) }));
  const post = talkPost(session.rows, origin);

  return (
    <Section
      icon={<ClipboardList />}
      title="話した話題のまとめ"
      description="NOW にした話題を、順番と時刻つきで残しています。ボードを切り替えながら話しても 1 本につながります（この端末だけに保存）。"
    >
      {sessions.length > 1 ? (
        <Select
          items={items}
          value={session.id}
          onValueChange={(value) => {
            if (typeof value === "string") setSelected(value);
          }}
        >
          <SelectTrigger className="w-full" aria-label="どの配信のまとめか">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="shrink-0">配信を始めた時刻</span>
        <Input
          type="time"
          value={clock}
          onChange={(event) => setClocks((current) => ({ ...current, [session.id]: event.target.value }))}
          className="w-28"
        />
      </label>

      {shown.length === 0 ? (
        <p className="text-xs leading-5 text-muted-foreground">この時刻より後に話した話題はありません。時刻を早めてみてください。</p>
      ) : (
        <ol className="space-y-1">
          {shown.map(({ row, offset }) => {
            const length = talkDuration(row, row === lastRow, now);
            return (
              <li key={row.ids[0]} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2 py-1.5 text-xs">
                <span className="w-12 shrink-0 tabular-nums text-muted-foreground">{formatOffset(offset)}</span>
                <span className="min-w-0 flex-1 break-words">
                  {row.label}
                  {withTheme && row.theme !== row.label ? (
                    <span className="block text-[11px] leading-4 text-muted-foreground">{row.theme}</span>
                  ) : null}
                </span>
                {length !== null ? (
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {row.end === undefined ? "話し中 " : ""}
                    {minutesLabel(length)}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`「${row.label}」をまとめから外す`}
                  title="まとめから外す"
                  onClick={() => removeTalkRow(row.ids)}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {shown.length < session.rows.length && shown.length > 0 ? (
        <p className="text-[11px] leading-4 text-muted-foreground">
          配信を始める前の {session.rows.length - shown.length} 件は入れていません。
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={shown.length === 0}
          onClick={() => void copyText(talkTimestamps(session.rows, origin), "タイムスタンプをコピーしました")}
        >
          <Copy />
          タイムスタンプをコピー
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!post}
          onClick={() => void copyText(post, "X 用の文をコピーしました")}
        >
          <Copy />X 用にコピー
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!post}
          onClick={() => window.open(tweetIntentUrl(post, siteUrl()), "_blank", "noopener,noreferrer")}
        >
          X で投稿
        </Button>
      </div>
      <p className="text-[11px] leading-4 text-muted-foreground">
        タイムスタンプは、配信の概要欄に貼るとチャプターになります。10 秒より短い NOW は数えません。
      </p>
    </Section>
  );
}
