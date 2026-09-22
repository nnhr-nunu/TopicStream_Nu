"use client";

import { Users } from "lucide-react";

import { ThemeBoardList } from "@/components/theme-board-list";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { CatalogBoard } from "@/lib/catalog-data";

export function ThemeBoardSheet({
  onImport,
}: {
  onImport: (board: CatalogBoard) => void;
}) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" size="icon-sm" aria-label="みんなのトークテーマ" />}>
        <Users />
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(100%,28rem)] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>みんなのトークテーマ</SheetTitle>
          <SheetDescription>検索して、自分のボードへ取り込みます。マップはそのまま残ります。</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-8">
          <ThemeBoardList onImport={onImport} compact />
        </div>
      </SheetContent>
    </Sheet>
  );
}
