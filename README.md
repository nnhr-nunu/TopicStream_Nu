# TopicStream_Nu

雑談配信向けの話題マインドマップです。キーワードをクリックすると、同じ色の 3×3（マンダラート）で関連トークが広がります。

## 公開URL

- GitHub Pages（キーなしデモ）: https://nnhr-nunu.github.io/
- Vercel で Gemini を使うときは、下の「短いURL」を共有してください。`…-projects.vercel.app` のような長いアドレスは **Preview のデプロイURL** で、配信用の共有先ではありません。

## 動かし方

必要: Node.js 20 以降

```bash
npm install
cp .env.example .env.local
npm run dev
```

http://127.0.0.1:43173 を開きます。テストは `npm test`。

## つかいかた

1. ホームでキーワードを入れて「始める」。ランダムは欄にネタを入れるだけで、まだマップは開きません
2. 話題をクリックすると新しい 3×3。中央は同じ ID のまま色が変わる。周囲が新しい ID。線は中心同士だけ
3. カードの上にメニュー（横並び）。♡ でお気に入り、📝 で付箋。ピンした話題は NOW
4. マップ下に配信URL（Studioのライブチャットでも `/video/{id}/livestreaming` でも可）。つながると **連携中**。コメント表示をオンにすると左にチャット。`1Eが聞きたい` や `4F` でそのマスが光り、枠にハートが残る（最初の中央は 1E）
5. ホームの「このサービスを利用している配信」に、いま TopicStream を使っている枠が並ぶ。タイトルから本編へ。マップ下に配信URLを貼ると、その枠も同じ一覧の一行になる

ショートカット: `E` 展開 · `G` 再生成（そのマスの文だけ） · `Z` 戻る · `Y` 進む · `+` `-` 拡大 · `0` 全体

OBS: `https://nnhr-nunu.github.io/overlay/?transparent=1`（1920×1080）

## Vercel と Gemini

実キーはリポジトリに置かないでください。oshilog など別アプリの [Google AI Studio](https://aistudio.google.com/apikey) キーを使い回してよいです。

1. Vercel の Project → Settings → Environment Variables に `GEMINI_API_KEY` を入れる。値の前後に `"` や `'` を付けない
2. **Production と Preview の両方** にチェックする。長い `*-projects.vercel.app` は Preview なので、Production だけだとそこではオフライン生成になります
3. 変えたあとは **Production** を Redeploy する。`topic-stream-amber.vercel.app` は Production ドメインなので、Preview だけ直してもここには乗らない
4. `GET /api/gemini` の `configured: true` は **キーが入っていることだけ**。Google が通ったかは POST の `source` と `debug` を見る
5. 短いURL: Project → **Domains** で `好きな名前.vercel.app` か自分のドメインを追加する。これが共有用です

## キー（任意・コミットしない）

| 名前 | 用途 |
| --- | --- |
| `GEMINI_API_KEY` | 話題の生成。無いときはオフライン生成。サーバーの `/api/gemini` だけが読む |
| `YOUTUBE_API_KEY` | YouTubeライブチャット。無いときはテストコメント |
| Twitch | 公開チャットはブラウザから匿名で読む。トークン不要 |

手元は `.env.local` か設定画面。マップ下の「配信URL」に YouTube / Twitch の配信リンクやチャットURLを貼ります。
