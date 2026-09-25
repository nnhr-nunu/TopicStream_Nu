# TopicStream_Nu

雑談配信向けの話題マインドマップです。キーワードをクリックすると、同じ色の 3×3（マンダラート）で関連トークが広がります。

## 公開URL

- GitHub Pages（キーなしデモ）: https://nnhr-nunu.github.io/
- 独自ドメイン: https://topic-stream.oshilog.life/（Vercel の Domains + Cloudflare の CNAME）
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
4. `GET /api/gemini` の `configured: true` は **キーが入っていることだけ**。実際に生成できるかは、設定画面の「AI の話題づくりがうまくいかないとき」→「AI を試す」で確かめる
5. 短いURL: Project → **Domains** で `好きな名前.vercel.app` か自分のドメインを追加する。これが共有用です

## トピック図鑑（集合知）

AI が出した話題を「お題 → 出てきた語（回数つき）」の形でためて、同じお題・似たお題では AI を呼ばずに候補を出します。`/topics/` で検索・分類別に見られ、そのままボードにできます。

- 保存先は3つ: 同梱の初期データ（[`topic-knowledge-seed-data.ts`](./src/lib/topic-knowledge-seed-data.ts) の手書き分など。キー無しの公開版でも使える）・自分の端末（localStorage）・みんなの図鑑（Upstash Redis）
- 記録するのは AI の結果（`/api/gemini` と下の自動育成）と、選ばれた語の票（♡・クリックで広げた・ピン・コピー・自分で書き直した語・コメントのハート）。票の多い語・お題ほど上に出る
- 今はデータ集めを優先して、票は図鑑に無い語でもそのまま加え、回数も絞っていない。画面は数秒ごとにまとめて送る（荒らしが出てきたら `/api/knowledge` の POST で絞る）
- 「作り直す」は 予備 → 図鑑 → AI の順。広げるときも、図鑑にそのお題の語が十分あれば 4 回に 3 回は図鑑から出す
- みんなの図鑑は Redis が無いとサーバーのメモリだけ（Vercel では再起動で消える）。育てたいときは上の `KV_REST_API_*` を入れて再デプロイ
- URL・メールアドレス・電話番号・@ハンドルを含む語は記録しない

### 自動で育てる（Vercel Cron）

`/api/knowledge/grow` が毎日 1 回（UTC 6 時台 = 日本時間 15 時台）、語の少ないお題と、よく選ばれた語（次にお題になりやすい）を AI に広げてもらって図鑑に入れます。Gemini の 1 日の枠は太平洋時間 0 時（日本時間 16〜17 時）に戻るので、その直前に「その日の余り」を使う設計です。上限（quota）に当たったらその場でやめます。

1. Vercel の Environment Variables に `CRON_SECRET`（長いランダムな文字列）を Production で入れて再デプロイ。未設定だと自動育成は動きません（誰でも呼べて枠を使われるのを防ぐため）
2. 1 回に頼む数は `GROW_LIMIT`（既定 20、最大 60。1 回の実行は 60 秒まで）
3. 公開前にまとめて育てるときは、手で何度か呼ぶ: `curl -H "Authorization: Bearer $CRON_SECRET" "https://<本番ドメイン>/api/knowledge/grow?limit=20"`

## 広告（Google AdSense・任意）

ホーム・`/community/`・`/guide/` の最下部に広告枠を 1 つ出します。ホームは画面幅が 1360px 以上あると、本文の左右にも縦長（160×600）の枠を出します。オーバーレイと「いっしょに見る」には出しません。Vercel の Environment Variables に次を入れて再デプロイすると有効になります。未設定なら広告関連のタグは一切出ません（GitHub Pages のデモも未設定なので広告なし）。

| 名前 | 内容 |
| --- | --- |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | `ca-pub-` で始まるパブリッシャー ID |
| `NEXT_PUBLIC_ADSENSE_SLOT` | ディスプレイ広告ユニットのスロット ID（数字） |
| `NEXT_PUBLIC_ADSENSE_SIDE_SLOT` | 任意。左右の縦長枠用のスロット ID。未設定なら `NEXT_PUBLIC_ADSENSE_SLOT` を流用 |

`NEXT_PUBLIC_*` はビルド時に埋め込まれるので、値を変えたら Redeploy が必要です。

## キー（任意・コミットしない）

| 名前 | 用途 |
| --- | --- |
| `GEMINI_API_KEY` | 話題の生成。無いときはオフライン生成。サーバーの `/api/gemini` だけが読む |
| `YOUTUBE_API_KEY` | YouTubeライブチャット。無いときはテストコメント。1日1万ユニットの枠があるので、8秒より短い間隔では読まない |
| Twitch | 公開チャットはブラウザから匿名で読む。トークン不要 |
| `CRON_SECRET` | トピック図鑑の自動育成（`/api/knowledge/grow`）を呼ぶための合言葉。Vercel Cron が自動で付ける |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | みんなのトピック図鑑の保存先（Upstash Redis）。Vercel の Storage → Marketplace で Upstash Redis をつなぐと自動で入る。`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` でも可 |

キーはサーバーの環境変数だけで使います（手元は `.env.local`）。利用者が画面で入力する欄はありません。マップ下の「配信と連携」に YouTube / Twitch の配信リンクやチャットURLを貼ります。

## 使用量の監視

YouTube Data API の枠と Gemini の使用量は、推しログ(ぬ) の管理画面「使用量」にまとめて表示され、通知ラインを超えるとメールが届きます（推しログ側の `TOPICSTREAM_GCP_PROJECT_ID` などで有効化。手順は推しログの `docs/operations/PRODUCTION_ENV_SETUP.md` §3.2）。配信中にすぐ知りたい場合は、GCP の Cloud Monitoring アラート（割り当て使用量）も併用してください。
