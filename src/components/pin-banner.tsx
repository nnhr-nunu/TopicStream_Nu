"use client";

import { useEffect, useState, type ReactNode } from "react";

/** 話している時間（m:ss。1 時間を超えたら h:mm:ss） */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <span className="pin-banner-time" title="この話題を話している時間">
      {formatElapsed(now - since)}
    </span>
  );
}

export function PinBanner({
  label,
  since,
  fromListener = false,
  children,
}: {
  label: string;
  since?: number;
  /** 視聴者がコメントで出したお題（お題箱から採用したカード） */
  fromListener?: boolean;
  /** 帯のすぐ下に並べるお知らせ（帯が 2 行になっても重ならず、左下の操作にもかぶらない） */
  children?: ReactNode;
}) {
  const shown = Boolean(label.trim());
  if (!shown && !children) return null;
  return (
    <div className="pin-banner">
      {shown ? (
        <div className="pin-banner-inner" role="status" title={label}>
          <span className="pin-banner-now">NOW</span>
          <p className="pin-banner-text">{label}</p>
          {fromListener ? <span className="pin-banner-listener">リスナーのお題</span> : null}
          {since ? <Elapsed key={since} since={since} /> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
