import Link from "next/link";

import { cn } from "@/lib/utils";

const LINK = "text-muted-foreground underline-offset-2 hover:underline";

/** トピック図鑑・使い方・プライバシーポリシーへの小さなリンク。ホームと一覧ページの最下部に置く。 */
export function SiteLinks({ className }: { className?: string }) {
  return (
    <p className={cn("flex justify-center gap-4 text-xs", className)}>
      <Link href="/topics/" className={LINK}>
        トピック図鑑
      </Link>
      <Link href="/guide/" className={LINK}>
        使い方
      </Link>
      <Link href="/privacy/" className={LINK}>
        プライバシーポリシー
      </Link>
    </p>
  );
}
