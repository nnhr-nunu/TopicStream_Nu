"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, Copy, Download, LayoutGrid, Pencil, Plus, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Board } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatUpdated(ms: number): string {
  const date = new Date(ms);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const hm = `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
  return sameDay ? `今日 ${hm}` : `${date.getMonth() + 1}/${date.getDate()} ${hm}`;
}

function BoardRow({
  board,
  active,
  canDelete,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: {
  board: Board;
  active: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [mode, setMode] = useState<"view" | "rename" | "confirm">("view");
  const [name, setName] = useState(board.name);
  const cards = board.nodes.length;

  if (mode === "rename") {
    return (
      <li className="board-row board-row-editing">
        <form
          className="flex w-full items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            onRename(name);
            setMode("view");
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setName(board.name);
                setMode("view");
              }
            }}
            maxLength={40}
            autoFocus
            aria-label="ボード名"
            className="h-9"
          />
          <Button type="submit" size="icon-sm" aria-label="名前を保存">
            <Check />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="やめる"
            onClick={() => {
              setName(board.name);
              setMode("view");
            }}
          >
            <X />
          </Button>
        </form>
      </li>
    );
  }

  if (mode === "confirm") {
    return (
      <li className="board-row board-row-danger">
        <p className="min-w-0 flex-1 text-xs leading-5">
          「<span className="font-semibold">{board.name}</span>」を削除します。元に戻せません。
        </p>
        <div className="flex shrink-0 gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => setMode("view")}>
            やめる
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => {
              onDelete();
              setMode("view");
            }}
          >
            削除
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className={cn("board-row", active && "board-row-active")}>
      <button type="button" className="board-row-open" onClick={onOpen} aria-current={active ? "true" : undefined}>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{board.name}</span>
          {active ? <span className="board-row-badge">表示中</span> : null}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {cards > 0 ? `カード ${cards}枚` : "まだ空です"} · {formatUpdated(board.updatedAt)}
        </span>
      </button>
      <div className="board-row-actions">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`「${board.name}」の名前を変更`}
          title="名前を変更"
          onClick={() => {
            setName(board.name);
            setMode("rename");
          }}
        >
          <Pencil />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`「${board.name}」を複製`}
          title="複製"
          onClick={onDuplicate}
        >
          <Copy />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`「${board.name}」を削除`}
          title={canDelete ? "削除" : "最後の1つは削除できません"}
          disabled={!canDelete}
          onClick={() => setMode("confirm")}
          className="hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

export function BoardPanel({
  boards,
  activeBoard,
  onOpen,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
  onExport,
  onImport,
}: {
  boards: Board[];
  activeBoard: Board;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onRename: (name: string, id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onImport: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sorted = [...boards].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="app-crumb-board max-w-[min(52vw,18rem)]"
            aria-label={`ボード「${activeBoard.name}」— ボードの一覧を開く`}
          />
        }
      >
        <span className="truncate font-semibold">{activeBoard.name}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(100%,24rem)] gap-0">
        <SheetHeader className="gap-1 pb-3">
          <SheetTitle className="flex items-center gap-2">
            <LayoutGrid className="size-4 text-primary" />
            ボード
          </SheetTitle>
          <SheetDescription className="text-xs">
            雑談ごとの盤面です。このブラウザに保存されます。
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-3">
          <Button
            type="button"
            className="h-10 w-full rounded-xl"
            onClick={() => {
              onCreate();
              setOpen(false);
            }}
          >
            <Plus />
            新しいボードを始める
          </Button>
        </div>

        <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-3">
          {sorted.map((board) => (
            <BoardRow
              key={board.id}
              board={board}
              active={board.id === activeBoard.id}
              canDelete={boards.length > 1}
              onOpen={() => {
                onOpen(board.id);
                setOpen(false);
              }}
              onRename={(name) => onRename(name, board.id)}
              onDuplicate={() => {
                onDuplicate(board.id);
                setOpen(false);
              }}
              onDelete={() => onDelete(board.id)}
            />
          ))}
        </ul>

        <SheetFooter className="flex-row gap-2 border-t border-border/70 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            title="全ボードをJSONで保存します（APIキーは含みません）"
            onClick={onExport}
          >
            <Download />
            書き出す
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            title="JSONから復元します（今のボードはすべて置き換わります）"
            onClick={() => fileRef.current?.click()}
          >
            <Upload />
            読み込む
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              onImport(await file.text());
              event.target.value = "";
              setOpen(false);
            }}
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
