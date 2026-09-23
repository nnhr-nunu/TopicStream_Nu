"use client";

import { createContext, useContext } from "react";

import type { GenerationLayout } from "@/lib/types";

type BoardActions = {
  expandNode: (id: string) => void;
  regenerateNode?: (id: string) => void;
  pinNode: (id: string | null) => void;
  setMemo: (id: string, memo: string) => void;
  setLabel?: (id: string, label: string) => void;
  copyLabel: (id: string) => void;
  toggleHeart?: (id: string) => void;
  overlay?: boolean;
  pinnedNodeId: string | null;
  focusedNodeId: string | null;
  generationLayout?: GenerationLayout;
};

const BoardActionsContext = createContext<BoardActions | null>(null);

export function BoardActionsProvider({
  value,
  children,
}: {
  value: BoardActions;
  children: React.ReactNode;
}) {
  return <BoardActionsContext.Provider value={value}>{children}</BoardActionsContext.Provider>;
}

export function useBoardActions() {
  const value = useContext(BoardActionsContext);
  if (!value) {
    throw new Error("BoardActionsProvider がありません");
  }
  return value;
}
