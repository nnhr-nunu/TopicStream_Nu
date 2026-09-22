# TopicStream_Nu

雑談配信向けの話題マインドマップです。キーワードをクリックすると関連トークが放射状に広がります。配信者とリスナーが同じ画面を見ながら話せます。

自分のボードはブラウザ内だけに保存します。ログインは不要です。

## 公開URL

https://nnhr-nunu.github.io/

GitHub Pages の無料枠で公開しています。キーなしでもオフライン生成で触れます。

いまの公開サイトは静的ホストのため、サーバー側の `GEMINI_API_KEY` は使えません。本番で Gemini を使うには、このリポジトリを [Vercel](https://vercel.com/) 無料枠に繋いで、Project → Settings → Environment Variables に `GEMINI_API_KEY` を足してください。実キーはリポジトリに置かないでください。

## 動かし方

必要: Node.js 20 以降

```bash
npm install
cp .env.example .env.local
# .env.local の GEMINI_API_KEY= にキーを書く（任意）
npm run dev
```

ブラウザで http://127.0.0.1:43173 を開きます。

本番ビルド:

```bash
npm run build
npm start
```

テスト:

```bash
npm test
```

## Gemini APIキー

実キーはどこにもコミットしません。名前だけ `GEMINI_API_KEY` です。

1. [Google AI Studio](https://aistudio.google.com/apikey) でキーを発行する
2. **手元**: プロジェクト直下の `.env.local` に `GEMINI_API_KEY=` を書くか、アプリ設定の上書き欄（このブラウザの Local Storage だけ）。設定欄は `/api/gemini` があるホスト向けです
3. **Vercel に載せたとき**: Project → Settings → Environment Variables に `GEMINI_API_KEY` を追加する。Production / Preview の両方に付けるとプレビューでも使えます
4. **いまの公開サイト（GitHub Pages）**: サーバーキーは置けないので、未設定時と同じオフライン生成です
5. クライアントはサーバーのキーを読みません

## 画面

| 画面 | URL |
| --- | --- |
| 配信ホーム（キーワード・人気・みんなのボード） | `/` |
| みんなのトークテーマ（同じカタログ） | `/community/` |
| いっしょに見る | `/watch/?id=（共有ID）` |
| OBS | `/overlay/?transparent=1` |

## 使い方（配信中）

1. ホームでキーワードを入れるか、「よく選ばれているトピック」か「みんなのトークテーマ」から始める
2. ノードをクリックすると関連キーワードが約8個、親からにゅっと生える
3. しっくりこなければ **再生成**。**1つ戻る** / **進む** も使えます
4. ピンは「NOW」。付箋はノードの横
5. 配色は 爽やか / 落ち着き / 配信ダーク。オーバーレイでも文字が読めるようにしてあります
6. 共有アイコンで「いっしょに見る」リンクをコピー（公開サイトでは共有APIがないため、自分のマップの共有は手元または Vercel 向けです）

ショートカット: `E` 展開 · `G` 再生成 · `Z` 戻る · `Y` 進む · `R` ランダム · `P` ピン · `C` コピー

## OBS オーバーレイ

| 項目 | 値 |
| --- | --- |
| 手元 | `http://127.0.0.1:43173/overlay?transparent=1` |
| 本番 | `https://nnhr-nunu.github.io/overlay/?transparent=1` |
| 幅 | `1920` |
| 高さ | `1080` |

Custom CSS:

```css
body { background-color: rgba(0, 0, 0, 0); margin: 0; overflow: hidden; }
```

OBS の Browser Source は Chrome と Local Storage を共有しません。ライブで広げたいときはブラウザの `/overlay` をキャプチャするか、OBS の「対話」を使います。
