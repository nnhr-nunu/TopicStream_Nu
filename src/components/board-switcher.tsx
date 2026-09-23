"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, Copy, Download, FolderPlus, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  onDuplicate,
  onExport,
  onImport,
}: {
  boards: Board[];
  activeBoard: Board;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onExport: () => void;
  onImport: (text: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(activeBoard.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex min-w-0 items-center gap-1">
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
        <>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="max-w-[min(100%,16rem)]" />}>
              <span className="truncate font-medium">{activeBoard.name}</span>
              <ChevronDown className="size-3.5 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-60">
              <p className="px-2 py-1.5 text-[11px] text-muted-foreground">今日の雑談</p>
              {boards.map((board) => (
                <DropdownMenuItem key={board.id} onClick={() => onSwitch(board.id)}>
                  <span className="truncate">{board.name}</span>
                  {board.id === activeBoard.id ? <Check className="ml-auto size-3.5" /> : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setName(activeBoard.name);
                  setEditing(true);
                }}
              >
                <Pencil />
                名前を変更
              </DropdownMenuItem>
              {onDuplicate ? (
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy />
                  複製する
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={onExport}>
                <Download />
                JSONを書き出す
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileRef.current?.click()}>
                <Upload />
                JSONを読み込む
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 />
                このボードを削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0"
            onClick={onCreate}
            aria-label="新しい雑談を始める"
          >
            <FolderPlus className="size-3.5" />
            新規
          </Button>
        </>
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
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>このボードを削除しますか？</DialogTitle>
            <DialogDescription>
              「{activeBoard.name}」は戻せません。最後の1つは削除できません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
              やめる
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (boards.length <= 1) {
                  toast.error("最後のボードは削除できません");
                  setConfirmDelete(false);
                  return;
                }
                onDelete();
                setConfirmDelete(false);
              }}
            >
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
