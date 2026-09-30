import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

/** 設定画面の 1 行（左に項目名、右に操作） */
export function Row({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2">
        <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        <div className="min-w-0">{children}</div>
      </div>
      {hint ? <p className="pl-[6rem] text-[11px] leading-4 text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

/** 設定画面のまとまり（見出しと枠） */
export function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-3">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold [&_svg]:size-4 [&_svg]:text-primary">
          {icon}
          {title}
        </h3>
        {description ? <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
