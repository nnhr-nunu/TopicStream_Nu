# AI エージェント向けガイド（TopicStream）

Cursor / Claude Code で開発するときの最短導線。全文読み込みを避け、触るファイルだけ開く。

## 最初に読む（タスク別）

| やること | 入口 |
| -------- | ---- |
| マンダラート（3×3）の生成・展開ロジック | [`mandala.ts`](./src/lib/mandala.ts) → [`mandala-ids.ts`](./src/lib/mandala-ids.ts) |
| ボード（トピック盤面）の状態操作 | [`board-ops.ts`](./src/lib/board-ops.ts) + [`board-store.ts`](./src/lib/board-store.ts) → 画面は [`board-canvas.tsx`](./src/components/board-canvas.tsx) / [`topic-workspace.tsx`](./src/components/topic-workspace.tsx) |
| ノード配置・レイアウト計算 | [`layout.ts`](./src/lib/layout.ts) / [`radial-layout.ts`](./src/lib/radial-layout.ts) / [`node-box.ts`](./src/lib/node-box.ts) |
| Gemini 連携（トピック生成） | [`gemini-core.ts`](./src/lib/gemini-core.ts)（サーバー専用ロジック）→ [`gemini.ts`](./src/lib/gemini.ts)（クライアント呼び出し）→ [`app/api/gemini/`](./src/app/api/gemini/) |
| キー無し時のオフライン生成 | [`mock-topics.ts`](./src/lib/mock-topics.ts) / [`starters.ts`](./src/lib/starters.ts) |
| ライブチャット連動（YouTube/Twitch） | [`live-chat-dock.tsx`](./src/components/live-chat-dock.tsx) + [`live-store.ts`](./src/lib/live-store.ts) / [`live-pulse.ts`](./src/lib/live-pulse.ts) + [`chat-parse.ts`](./src/lib/chat-parse.ts) |
| 配信ディレクトリ（community 一覧） | [`stream-directory.ts`](./src/lib/stream-directory.ts) → [`community-catalog.tsx`](./src/components/community-catalog.tsx) / [`app/community/`](./src/app/community/) |
| オーバーレイ（OBS用） | [`app/overlay/`](./src/app/overlay/) + [`overlay-workspace.tsx`](./src/components/overlay-workspace.tsx) |
| お気に入り・付箋 | [`favorites.ts`](./src/lib/favorites.ts) / [`sticky-note-panel.tsx`](./src/components/sticky-note-panel.tsx) |
| ショートカット | [`use-hotkeys.ts`](./src/hooks/use-hotkeys.ts) |
| 未完了タスク | [`task.md`](./task.md) |
| セットアップ・キー・公開URL | [`README.md`](./README.md) |

## 読まない（日常改修）

| ファイル | 理由 | 代わり |
| -------- | ---- | ------ |
| `HISTORY.md`（作った場合） | アーカイブ | `git log` |
| 長い製品メモの全文 | トークン消費 | `task.md` / 上表の入口 |

## 2つのビルド先（取り違え注意）

このアプリは **2箇所** にデプロイされる。片方だけ直して壊さないこと。

| 先 | ビルド | 特徴 |
| --- | ------ | ---- |
| GitHub Pages（キー無しデモ） | `npm run build:pages`（[`scripts/build-pages.sh`](./scripts/build-pages.sh)、`STATIC_EXPORT=1`） | `src/app/api` と `watch/[id]` を一時退避して `next build` する静的エクスポート。API route・動的ルートを増やしたら [`.github/workflows/pages.yml`](./.github/workflows/pages.yml) の `build:pages` が壊れないか確認 |
| Vercel（Gemini 連携あり） | `npm run build`（通常ビルド） | `GEMINI_API_KEY` / `YOUTUBE_API_KEY` はサーバー専用。**クライアントに漏らさない**（[`env-secret.ts`](./src/lib/env-secret.ts) 参照） |

- `next.config.ts` は `STATIC_EXPORT=1` の有無で `output: "export"` を切り替える。ここを直接いじらず、両ビルドで `npm test` → 該当ビルドコマンドを通す
- API route を追加したら、静的エクスポートでも壊れないか（`build:pages` が退避対象に含めているか）を確認する

## 制約

- Twitch は匿名でブラウザから公開チャットを読むだけ。トークンを要求する実装にしない
- 実キー（`GEMINI_API_KEY` 等）はコミットしない。`.env.example` のみ更新
- キー無しでも動くこと（オフライン生成・テストコメント）が前提。新機能もこのフォールバックを維持する

## Git

切りの良いところで日本語メッセージで commit し `origin` へ push する。`.ts` / `.tsx` を変えたら `npm test` と `npm run lint`。可能なら `npm run typecheck` も通す。

Windows の既定ターミナルは PowerShell（[`.vscode/settings.json`](./.vscode/settings.json)）。bash 形式の heredoc は使わず、1行メッセージか PowerShell here-string（`@'...'@`）/ `git commit -F` を使う。

## ドキュメント

- 完了タスク → `task.md` から削除（履歴は `git log`）
- README は起動手順・公開URL・キーの説明のみ。製品メモが増えるなら `docs/product/` を新設
- 800 行を超えるファイルは責務単位で分割する（現状 `board-ops.ts` が606行で最大 — 増やすなら分割を検討）
