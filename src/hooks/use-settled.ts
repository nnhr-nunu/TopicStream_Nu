"use client";

import { useEffect, useState } from "react";

/** 値が ms のあいだ変わらなくなってから返す（入力途中の値で接続・送信しない）。最初の値はそのまま返す */
export function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return settled;
}
