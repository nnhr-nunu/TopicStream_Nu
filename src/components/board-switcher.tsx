"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, Download, FolderPlus, Pencil, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { Board } from "@/lib/types";

export function BoardSwitcher({
  boards,
  activeBoard,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  onExport,
  onImport,
}: {
  boards: Board[];
  activeBoard: Board;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onExport: () => void;
  onImport: (text: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(activeBoard.name);

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {editing ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            onRename(name);
            setEditing(false);
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-8 w-44"
            autoFocus
            aria-label="ボード名"
          />
          <Button type="submit" size="icon-sm" variant="ghost" aria-label="名前を保存">
            <Check />
          </Button>
        </form>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="max-w-[220px]" />}>
            <span className="truncate">{activeBoard.name}</span>
            <ChevronDown className="size-3.5 opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-56">
            {boards.map((board) => (
              <DropdownMenuItem key={board.id} onClick={() => onSwitch(board.id)}>
                <span className="truncate">{board.name}</span>
                {board.id === activeBoard.id ? <Check className="ml-auto size-3.5" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCreate}>
              <FolderPlus />
              新しいボード
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setName(activeBoard.name);
                setEditing(true);
              }}
            >
              <Pencil />
              名前を変更
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport}>
              <Download />
              JSONを書き出す
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileRef.current?.click()}>
              <Upload />
              JSONを読み込む
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 />
              このボードを削除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
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
        }}
      />
    </div>
  );
}
