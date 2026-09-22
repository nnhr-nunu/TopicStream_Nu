"use client";

import { useSyncExternalStore } from "react";

import { ColorThemeSync } from "@/components/color-theme-sync";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import {
  getBoardSnapshot,
  getServerBoardSnapshot,
  subscribeBoardStore,
} from "@/lib/board-store";
import { asColorTheme, isDarkTheme } from "@/lib/color-theme";

function ThemedToaster() {
  const snapshot = useSyncExternalStore(subscribeBoardStore, getBoardSnapshot, getServerBoardSnapshot);
  const theme = asColorTheme(snapshot.settings.colorTheme);
  return <Toaster theme={isDarkTheme(theme) ? "dark" : "light"} position="bottom-center" />;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delay={250}>
      <ColorThemeSync />
      {children}
      <ThemedToaster />
    </TooltipProvider>
  );
}
