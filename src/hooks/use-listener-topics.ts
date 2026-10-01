"use client";

import { useSyncExternalStore } from "react";

import { addTopic, asTopicBox, clearTopics, emptyTopicBox, removeTopic, type TopicBox } from "@/lib/listener-topics";

/**
 * リスナーのお題箱（ページで 1 つ）。ボードを切り替えても、ホームへ戻っても、読み込み直しても、タブを閉じるまで残す。
 * 配信は 1 本なので、ボードごとには分けない
 */
const STORAGE_KEY = "topicstream-nu-listener-topics";
const EMPTY = emptyTopicBox();
let box: TopicBox | null = null;
const listeners = new Set<() => void>();

function read(): TopicBox {
  if (box) return box;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    box = raw ? asTopicBox(JSON.parse(raw)) : emptyTopicBox();
  } catch {
    box = emptyTopicBox();
  }
  return box;
}

function write(next: TopicBox) {
  if (next === read()) return;
  box = next;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* 残せなくても、このページの中では使える */
  }
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function addListenerTopic(label: string) {
  write(addTopic(read(), label, Date.now()));
}

export function removeListenerTopic(key: string) {
  write(removeTopic(read(), key));
}

export function clearListenerTopics() {
  write(clearTopics(read()));
}

export function useListenerTopics(): TopicBox {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
