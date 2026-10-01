"use client";

import { useState } from "react";

import { Inbox, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { clearListenerTopics, removeListenerTopic } from "@/hooks/use-listener-topics";
import { COLUMN_LIMIT, type ListenerTopic } from "@/lib/listener-topics";

function TopicItem({ topic, onAdopt }: { topic: ListenerTopic; onAdopt: (topic: ListenerTopic) => void }) {
  return (
    <li className="odai-item">
      <button
        type="button"
        className="odai-adopt"
        onClick={() => onAdopt(topic)}
      >
        <span className="odai-label">{topic.label}</span>
        {topic.count > 1 ? <span className="odai-count">×{topic.count}</span> : null}
      </button>
      <button
        type="button"
        className="odai-remove"
        aria-label={`「${topic.label}」を消す`}
        title="消す（同じお題が来ても、この配信のあいだは戻しません）"
        onClick={() => removeListenerTopic(topic.key)}
      >
        <X className="size-3" aria-hidden />
      </button>
    </li>
  );
}

function TopicList({ topics, onAdopt }: { topics: ListenerTopic[]; onAdopt: (topic: ListenerTopic) => void }) {
  return (
    <ul className="odai-list">
      {/* 数が増えるたびに付け直して、届いたことを一瞬光らせる */}
      {topics.map((topic) => (
        <TopicItem key={`${topic.key}:${topic.count}`} topic={topic} onAdopt={onAdopt} />
      ))}
    </ul>
  );
}

/** コメント欄の一番上: 多い順に 4 件まで。残りは下の帯のボタン（ListenerTopicPill）から。お題が届いたときだけ出す */
export function ListenerTopicColumn({
  topics,
  onAdopt,
}: {
  topics: ListenerTopic[];
  onAdopt: (topic: ListenerTopic) => void;
}) {
  return (
    <section className="odai-box" aria-label="お題箱">
      <p className="comment-overlay-title">
        お題箱<span className="comment-overlay-count">{topics.length}</span>
      </p>
      <TopicList topics={topics.slice(0, COLUMN_LIMIT)} onAdopt={onAdopt} />
    </section>
  );
}

/**
 * 下の帯のボタン: コメント欄に出しきれないお題（5 件目から。コメント欄を閉じているときは全部）があるときだけ出す。
 * 開くと全部の一覧と「全部消す」
 */
export function ListenerTopicPill({
  topics,
  columnOpen,
  onAdopt,
}: {
  topics: ListenerTopic[];
  columnOpen: boolean;
  onAdopt: (topic: ListenerTopic) => void;
}) {
  const [open, setOpen] = useState(false);
  const hidden = columnOpen ? topics.length - COLUMN_LIMIT : topics.length;
  if (hidden <= 0) return null;
  const label = columnOpen ? `お題箱 ほか ${hidden}` : `お題箱 ${hidden}`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<button type="button" className="map-odai-pill" aria-label={`リスナーのお題: ${label}（一覧を開く）`} />}
      >
        <Inbox className="size-3.5" aria-hidden />
        {label}
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-[min(92vw,20rem)] gap-2 p-3">
        <p className="text-xs font-semibold">リスナーのお題（{topics.length}）</p>
        <p className="text-[11px] leading-4 text-muted-foreground">押すとカードになって広がり、NOW になります。</p>
        <TopicList
          topics={topics}
          onAdopt={(topic) => {
            setOpen(false);
            onAdopt(topic);
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={() => {
            clearListenerTopics();
            setOpen(false);
          }}
        >
          全部消す
        </Button>
      </PopoverContent>
    </Popover>
  );
}
