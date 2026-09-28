"use client";

import { spriteRuns, spriteSize } from "@/lib/critter-sprite";
import { CRITTER_ICONS } from "@/lib/critter-cast";
import { CRITTER_KINDS, CRITTER_LABELS, type CritterKind, type CritterStylePref } from "@/lib/wait-critters";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STYLE_ITEMS: { value: CritterStylePref; label: string }[] = [
  { value: "mix", label: "おまかせ（両方）" },
  { value: "cute", label: "かわいい（カードの上や間）" },
  { value: "real", label: "リアル（カードの中）" },
];

/** 設定に並べる動物のアイコン（かわいい絵の1コマ） */
function CritterIcon({ kind }: { kind: CritterKind }) {
  const icons = CRITTER_ICONS[kind];
  return (
    <span className="flex h-9 items-end justify-center gap-px">
      {icons.map(({ sprite, frame }, index) => {
        const { w, h } = spriteSize(sprite);
        // 大きい絵も小さい絵も、だいたい同じ高さに収める
        const scale = Math.min(34 / icons.length / w, 34 / h, 2.4);
        return (
          <svg key={index} viewBox={`0 0 ${w} ${h}`} width={w * scale} height={h * scale} shapeRendering="crispEdges" aria-hidden>
            {spriteRuns(sprite.frames[frame]!, sprite.palette).map((run) => (
              <rect key={`${run.x}-${run.y}`} x={run.x} y={run.y} width={run.w} height={1} fill={run.fill} />
            ))}
          </svg>
        );
      })}
    </span>
  );
}

/** 設定の「待ち時間の動物」: 動物ごとの出す／出さないと、絵のタッチ */
export function CritterSettings({
  hidden,
  style,
  onChange,
}: {
  hidden: string[];
  style: CritterStylePref;
  onChange: (patch: { hiddenCritters?: string[]; critterStyle?: CritterStylePref }) => void;
}) {
  const allHidden = CRITTER_KINDS.every((kind) => hidden.includes(kind));
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-4 gap-1.5">
        {CRITTER_KINDS.map((kind) => {
          const on = !hidden.includes(kind);
          const label = CRITTER_LABELS[kind];
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={on}
              title={on ? `${label}を出さない` : `${label}を出す`}
              onClick={() => onChange({ hiddenCritters: on ? [...hidden, kind] : hidden.filter((item) => item !== kind) })}
              className={cn(
                "flex min-h-16 flex-col items-center justify-between gap-1 rounded-lg border px-1 pt-1.5 pb-1 text-[10px] leading-tight transition",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                on
                  ? "border-primary/35 bg-primary/5 text-foreground hover:bg-primary/10"
                  : "border-dashed border-border text-muted-foreground opacity-50 grayscale hover:opacity-75",
              )}
            >
              <CritterIcon kind={kind} />
              {/* 長い名前は「きつねと／たぬき」のように区切りのいいところで折り返す */}
              <span className="text-center [word-break:keep-all]">{label.replace("と", "と​")}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{allHidden ? "いまは動物を出しません" : "タップで出す／出さないを切り替え"}</span>
        <button
          type="button"
          className="shrink-0 rounded px-1.5 py-0.5 underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => onChange({ hiddenCritters: allHidden ? [] : [...CRITTER_KINDS] })}
        >
          {allHidden ? "すべて出す" : "すべて出さない"}
        </button>
      </div>
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">絵のタッチ</span>
        <Select
          items={STYLE_ITEMS}
          value={style}
          onValueChange={(value) => {
            if (value === "mix" || value === "cute" || value === "real") onChange({ critterStyle: value });
          }}
        >
          <SelectTrigger className="w-full" aria-label="待ち時間の動物の絵のタッチ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STYLE_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
