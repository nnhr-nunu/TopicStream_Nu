"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { openBoardFromTopics } from "@/lib/board-start";
import type { BoardMode } from "@/lib/types";
import { cn } from "@/lib/utils";

type StartProps = { seed: string; topics: string[]; mode: BoardMode };

/** お題ごとのページから、見えている 3×3 をそのまま自分のボードにして開く */
function useStartBoard({ seed, topics, mode }: StartProps) {
  const router = useRouter();
  return () => {
    openBoardFromTopics(seed, topics, mode);
    toast.success(`「${seed}」の話題マップを作りました`, {
      description: "気になるカードを押すと、そこからさらに 8 つ広がります",
      duration: 8_000,
    });
    router.push("/");
  };
}

/** マンダラートの並び（中央がお題、まわりの 8 マスが語） */
const CELLS = [0, 1, 2, 3, null, 4, 5, 6, 7] as const;

/**
 * お題ごとのページの 3×3 の見本。どのマスを押しても、この並びのままボードが始まる
 * （語は最初の HTML に入るので、検索エンジンにもそのまま読める）
 */
export function TopicPageMandala(props: StartProps) {
  const start = useStartBoard(props);
  return (
    <div className="topic-page-grid" role="group" aria-label={`「${props.seed}」の話題マップの見本`}>
      {CELLS.map((index) =>
        index === null ? (
          <button key="center" type="button" className="topic-page-cell topic-page-center" onClick={start}>
            {props.seed}
          </button>
        ) : (
          <button
            key={index}
            type="button"
            className="topic-page-cell"
            data-family={index}
            onClick={start}
            title="このお題で始める"
          >
            {props.topics[index]}
          </button>
        ),
      )}
    </div>
  );
}

export function TopicStartButton({
  className,
  children,
  ...props
}: StartProps & { className?: string; children: ReactNode }) {
  const start = useStartBoard(props);
  return (
    <button type="button" className={cn("topic-page-cta", className)} onClick={start}>
      {children}
    </button>
  );
}
