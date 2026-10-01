"use client";

/** 一番外側（layout）で落ちたとき。スタイルが読めていないこともあるので、最低限の見た目で出す */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f4f1e8",
          color: "#1d2a27",
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        <div>
          <h1 style={{ fontSize: 18 }}>うまく表示できませんでした</h1>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "#4d5b57" }}>
            作ったマップはこの端末に残っています。もう一度読み込んでみてください。
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ marginTop: 8, padding: "8px 16px", borderRadius: 12, border: 0, background: "#1f6f66", color: "#fff", fontSize: 14 }}
          >
            もう一度表示する
          </button>
        </div>
      </body>
    </html>
  );
}
