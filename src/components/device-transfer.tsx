"use client";

import { useState } from "react";
import { Copy, Download, Loader2, MonitorSmartphone, Upload } from "lucide-react";
import { toast } from "sonner";

import { Section } from "@/components/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTransferCode } from "@/lib/transfer";
import { receiveTransfer, sendTransfer } from "@/lib/transfer-client";

const UNAVAILABLE = "この公開版（デモ）では使えません。ボード一覧の「書き出す」「読み込む」で、ファイルにして運んでください。";

const SEND_ERRORS = {
  empty: "引き継ぐボードがまだありません。",
  "too-large": "ボードが多すぎて預けられませんでした。使わないボードを消すか、ボード一覧の「書き出す」でファイルにして運んでください。",
  unavailable: UNAVAILABLE,
  rate: "続けて作ったので、少し待ってからもう一度どうぞ。",
  failed: "引き継ぎコードを作れませんでした。通信の状態を見て、もう一度お試しください。",
} as const;

const RECEIVE_ERRORS = {
  code: "コードの形が違うようです。英数字 8 文字（例: ABCD-EFGH）を入れてください。",
  "not-found": "そのコードでは見つかりませんでした。15 分を過ぎたか、コードが違うようです。もう一度作り直してください。",
  unavailable: UNAVAILABLE,
  rate: "続けて試したので、少し待ってからもう一度どうぞ。",
  failed: "受け取れませんでした。通信の状態を見て、もう一度お試しください。",
} as const;

function clock(time: number): string {
  return new Date(time).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

/**
 * 設定の「別の端末へ引き継ぐ」。ボード（付箋も）と ♡ した話題を、短いコードで別の端末へ運ぶ。
 * 中身はコードで暗号化してから 15 分だけサーバーに預ける（transfer.ts）
 */
export function DeviceTransfer() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ code: string; expiresAt: number; boards: number } | null>(null);
  const [input, setInput] = useState("");
  const [receiving, setReceiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    const result = await sendTransfer();
    setSending(false);
    if (result.ok) setSent(result);
    else setError(SEND_ERRORS[result.reason]);
  }

  async function receive() {
    setReceiving(true);
    setError(null);
    const result = await receiveTransfer(input);
    setReceiving(false);
    if (!result.ok) {
      setError(RECEIVE_ERRORS[result.reason]);
      return;
    }
    setInput("");
    const parts = [
      result.added > 0 ? `新しく ${result.added} 件` : "",
      result.updated > 0 ? `更新 ${result.updated} 件` : "",
      result.kept > 0 ? `そのまま ${result.kept} 件（この端末の方が新しいか、同じ内容）` : "",
      result.favs > 0 ? `♡ ${result.favs} 件` : "",
    ].filter(Boolean);
    const arrived = result.added + result.updated > 0;
    toast.success("受け取りました", {
      description:
        parts.length > 0
          ? `${parts.join("・")}。${arrived ? "ホームのボード一覧から開けます。" : ""}`
          : "新しく足すものはありませんでした。",
      duration: 8_000,
    });
  }

  return (
    <Section
      icon={<MonitorSmartphone />}
      title="別の端末へ引き継ぐ"
      description="スマホで仕込んだボードを PC で開く、などに。ボード（付箋も）と ♡ した話題を運びます。設定と AI キーは運びません。"
    >
      <div className="space-y-2">
        <p className="text-xs font-medium">1. 元の端末で、コードを作る</p>
        {sent ? (
          <div className="rounded-lg bg-primary/10 px-3 py-2.5 text-center">
            <p className="font-mono text-2xl font-bold tracking-[0.18em]">{formatTransferCode(sent.code)}</p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              ボード {sent.boards} 件を預けました。{clock(sent.expiresAt)} まで使えます。
            </p>
            <div className="mt-2 flex justify-center gap-2">
              <Button
                size="xs"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(formatTransferCode(sent.code));
                    toast.success("コードをコピーしました");
                  } catch {
                    toast.error("コピーできませんでした");
                  }
                }}
              >
                <Copy />
                コピー
              </Button>
              <Button size="xs" variant="ghost" onClick={() => void send()} disabled={sending}>
                作り直す
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => void send()} disabled={sending}>
            {sending ? <Loader2 className="animate-spin" /> : <Upload />}
            引き継ぎコードを作る
          </Button>
        )}
      </div>

      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void receive();
        }}
      >
        <p className="text-xs font-medium">2. 新しい端末で、コードを入れる</p>
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setError(null);
            }}
            placeholder="ABCD-EFGH"
            aria-label="引き継ぎコード"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="min-w-0 flex-1 font-mono tracking-widest uppercase"
          />
          <Button type="submit" size="sm" disabled={receiving || !input.trim()}>
            {receiving ? <Loader2 className="animate-spin" /> : <Download />}
            受け取る
          </Button>
        </div>
      </form>

      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-2.5 py-2 text-xs leading-5">
          {error}
        </p>
      ) : null}
      <p className="text-[11px] leading-4 text-muted-foreground">
        中身はコードで暗号化してから 15 分だけ預けるので、コードを知らない人には読めません。受け取っても、今あるボードは消えません（同じボードは、あとで触った方を残します）。
      </p>
    </Section>
  );
}
