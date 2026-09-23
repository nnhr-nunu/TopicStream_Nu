"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  getBoardSnapshot,
  getServerBoardSnapshot,
  subscribeBoardStore,
} from "@/lib/board-store";
import { asColorTheme, isDarkTheme } from "@/lib/color-theme";

export function ColorThemeSync() {
  const snapshot = useSyncExternalStore(subscribeBoardStore, getBoardSnapshot, getServerBoardSnapshot);
  const theme = asColorTheme(snapshot.settings.colorTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle("dark", isDarkTheme(theme));
  }, [theme]);

  return null;
}
