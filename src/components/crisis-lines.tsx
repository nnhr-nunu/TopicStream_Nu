import { Phone, X } from "lucide-react";

import { HOTLINES } from "@/lib/crisis";

/** 重い話題のときに出す相談窓口（正本は哲マロの相談窓口の一覧）。onClose を渡すと閉じるボタンが付く */
export function CrisisLines({ onClose, className }: { onClose?: () => void; className?: string }) {
  return (
    <aside aria-labelledby="crisis-lines-title" className={["crisis-lines", className].filter(Boolean).join(" ")}>
      <div className="flex items-start justify-between gap-2">
        <h2 id="crisis-lines-title" className="text-sm font-bold">
          ひとりで抱えこまないでください
        </h2>
        {onClose ? (
          <button type="button" className="crisis-lines-close" onClick={onClose} aria-label="相談窓口を閉じる">
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <ul className="mt-2 space-y-1.5 text-xs">
        {HOTLINES.map((line) => (
          <li key={line.name} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <a href={line.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
              {line.name}
            </a>
            {line.tel ? (
              <a href={`tel:${line.tel.replaceAll("-", "")}`} className="inline-flex items-center gap-1 font-semibold tabular-nums">
                <Phone className="size-3" aria-hidden />
                {line.tel}
              </a>
            ) : null}
            <span className="text-muted-foreground">{line.hours}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
