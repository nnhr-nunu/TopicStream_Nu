# TopicStream_Nu

雑談配信向けの話題マインドマップです。キーワードをクリックすると、関連トークがすぐ近くに広がります。

## 公開URL

https://nnhr-nunu.github.io/

GitHub Pages の無料枠です。キーなしでもオフライン生成で触れます。本番で Gemini を使うには、このリポジトリを [Vercel](https://vercel.com/) に繋いで `GEMINI_API_KEY` を足してください。実キーはリポジトリに置かないでください。

## 動かし方

必要: Node.js 20 以降

```bash
npm install
cp .env.example .env.local
npm run dev
```

http://127.0.0.1:43173 を開きます。テストは `npm test`。

## つかいかた

1. ホームでキーワード・人気トピック・みんなのボードから始める
2. 話題をクリックすると、関連キーワードが親の近くに並ぶ。設定の広げかたで、放射かマンダラート（3×3マス）を選べる
3. 展開したあとは、その親と新しい子が画面の中央に来る。左下の − ＋ とホイール／ピンチで拡大。全体でマップ全体に合わせる
4. 左上の TopicStream ロゴでホームに戻る
5. しっくりこなければ再生成。1つ戻る／進むもある

ショートカット: `E` 展開 · `G` 再生成 · `Z` 戻る · `Y` 進む · `R` ランダム · `+` `-` 拡大 · `0` 全体

OBS: `https://nnhr-nunu.github.io/overlay/?transparent=1`（1920×1080）

## Gemini APIキー

名前だけ `GEMINI_API_KEY`。発行は [Google AI Studio](https://aistudio.google.com/apikey)。手元は `.env.local` か設定画面。いまの公開サイトは静的ホストなのでオフライン生成です。
