"use client";

import { createContext, useContext } from "react";

type BoardActions = {
  expandNode: (id: string) => void;
  regenerateNode?: (id: string) => void;
  pinNode: (id: string | null) => void;
  setMemo: (id: string, memo: string) => void;
  copyLabel: (id: string) => void;
  overlay?: boolean;
  pinnedNodeId: string | null;
  focusedNodeId: string | null;
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
