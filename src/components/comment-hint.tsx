"use client";

import { useEffect, useState } from "react";

import { cellCode, isCenterCell } from "@/lib/mandala-ids";
import type { TNode } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * 読み始めてから最初に出すまで（同じ下の真ん中に出る「コメントを読み始めました」のお知らせ（10 秒）が消えてから）・
 * 出している長さ・出し始めてから次に出すまで
 */
const FIRST_MS = 11_000;
const SHOW_MS = 14_000;
const EVERY_MS = 3 * 60_000;

/** 例に出せる番号（3×3 の周りのカード。周りが無ければ中心も） */
function exampleCodes(nodes: TNode[]): string[] {
  const coded = nodes.filter(
    (node) => !node.data.placeholder && typeof node.data.groupId === "number" && typeof node.data.cellIndex === "number",
  );
  const around = coded.filter((node) => !isCenterCell(node.data.cellIndex));
  return (around.length > 0 ? around : coded).map((node) => cellCode(node.data.groupId!, node.data.cellIndex!));
}

/**
 * 配信のコメントを読んでいる間、盤面の下に「コメントで話題を選べます！」をときどきふわっと出す（配信に映る視聴者向け）。
 * 例の番号は盤面にあるカードから、出すたびに変える。番号の無い盤面（放射）ではお題の送り方を出す。
 * 読み始めたら出し、読むのをやめたら外す（マウントし直して数え直す）
 */
export function CommentHint({ nodes, className }: { nodes: TNode[]; className?: string }) {
  const [visible, setVisible] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    const timers = new Set<number>();
    const later = (ms: number, run: () => void) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        run();
      }, ms);
      timers.add(id);
    };
    const show = () => {
      setRound((count) => count + 1 + Math.floor(Math.random() * 5));
      setVisible(true);
      later(SHOW_MS, () => setVisible(false));
      later(EVERY_MS, show);
    };
    later(FIRST_MS, show);
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, []);

  const codes = exampleCodes(nodes);
  const example = codes.length > 0 ? codes[round % codes.length] : null;
  return (
    <div className={cn("comment-hint", visible && "comment-hint-on", className)} aria-hidden={!visible}>
      <span className="comment-hint-icon" aria-hidden>
        💬
      </span>
      <span className="comment-hint-body">
        <strong>{example ? "コメントで話題を選べます！" : "コメントでお題を送れます！"}</strong>
        <span>
          {example ? (
            <>
              カードの番号（例: <b className="comment-hint-code">{example}</b>）を書いてね
            </>
          ) : (
            "「お題:〇〇」と書いてね"
          )}
        </span>
      </span>
    </div>
  );
}
