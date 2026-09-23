"use client";

import { useEffect, useRef } from "react";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

export function useHotkeys(handlers: {
  expand?: () => void;
  random?: () => void;
  undo?: () => void;
  redo?: () => void;
  regenerate?: () => void;
  pin?: () => void;
  copy?: () => void;
}) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const meta = event.metaKey || event.ctrlKey;
      const current = handlersRef.current;

      if ((key === "e" || key === "enter") && !meta) {
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
      if ((key === "y" && !meta) || (key === "z" && event.shiftKey)) {
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
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
