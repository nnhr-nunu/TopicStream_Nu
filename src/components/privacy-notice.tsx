"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

export const PRIVACY_NOTICE = "ボードや入力したお題・話題は公開されることがあるので、個人情報は書かないでください。";

const SHOW_MS = 6_500;

/**
 * 新しいボードを始めたときに、ふわっと出てふわっと消える注意書き。
 * `trigger` が変わるたびに出し直す（0 のときは出さない）。
 */
export function PrivacyNotice({ trigger }: { trigger: number }) {
  const [visibleFor, setVisibleFor] = useState(0);

  useEffect(() => {
    if (!trigger) return;
    const show = window.setTimeout(() => setVisibleFor(trigger), 0);
    const hide = window.setTimeout(() => setVisibleFor(0), SHOW_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [trigger]);

  if (!visibleFor) return null;
  return (
    <div className="privacy-notice" role="status" key={visibleFor}>
      <ShieldAlert className="size-4 shrink-0" aria-hidden />
      <span>{PRIVACY_NOTICE}</span>
    </div>
  );
}
