"use client";

import { useEffect, useRef } from "react";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Enter で押されるもの（ボタン・リンク・メニュー項目など）。Enter はそちらに任せる */
function isControlTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'button, a[href], summary, [role="button"], [role="menuitem"], [role="option"], [role="tab"], [role="radio"], [role="checkbox"], [role="switch"], [role="link"]',
    ),
  );
}

/** ダイアログ・シート・メニューが開いている間は、裏の盤面を操作しない */
function modalOpen(target: EventTarget | null): boolean {
  if (target instanceof HTMLElement && target.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) {
    return true;
  }
  return Boolean(document.querySelector('[data-slot="dialog-content"], [data-slot="sheet-content"]'));
}

export function useHotkeys(
  handlers: {
    expand?: () => void;
    random?: () => void;
    undo?: () => void;
    redo?: () => void;
    regenerate?: () => void;
    pin?: () => void;
    copy?: () => void;
    roulette?: () => void;
  },
  /** false の間（ホーム画面など、盤面が見えていないとき）は何もしない */
  enabled = true,
) {
  const handlersRef = useRef(handlers);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    handlersRef.current = handlers;
    enabledRef.current = enabled;
  }, [handlers, enabled]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!enabledRef.current) return;
      // 変換中の Enter・押しっぱなし・Alt との組み合わせ・ほかで処理済みのキーは見ない
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.repeat || event.altKey) return;
      if (isTypingTarget(event.target) || modalOpen(event.target)) return;
      const key = event.key.toLowerCase();
      const meta = event.metaKey || event.ctrlKey;
      const current = handlersRef.current;

      if ((key === "e" || (key === "enter" && !isControlTarget(event.target))) && !meta) {
        event.preventDefault();
        current.expand?.();
        return;
      }
      if (key === "r" && !meta) {
        event.preventDefault();
        current.random?.();
        return;
      }
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        current.undo?.();
        return;
      }
      if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        current.redo?.();
        return;
      }
      if (key === "g" && !meta) {
        event.preventDefault();
        current.regenerate?.();
        return;
      }
      if (key === "p" && !meta) {
        event.preventDefault();
        current.pin?.();
        return;
      }
      if (key === "c" && !meta) {
        event.preventDefault();
        current.copy?.();
        return;
      }
      if (key === "n" && !meta && current.roulette) {
        event.preventDefault();
        current.roulette();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
