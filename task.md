# TopicStream タスク一覧（未完了のみ）

完了の詳細は `git log`。制約はエージェント用の [`AGENTS.md`](./AGENTS.md)。

## 残り: 公開前の総点検の続き（2026-09-29）

済: 全体のバグ調査と修正（ライブチャット・ショートカット・戻す/進む・保存/読み込み・サーバーの守り・図鑑の精度）、話題ルーレット（N キー）・「話した」の印・NOW の経過時間、共有カード画像（`src/app/opengraph-image.png`、元の HTML はコミットしていない）・404/エラー画面・robots/sitemap。いっしょに見るリンクは作った人だけが持つ鍵で書き換える（`live-store.ts` の `saveShare`）。

- YouTube のチャット読み込みは 8 秒おき。`liveChatMessages.list` が 1 回 5 ユニットなら、1 日 1 万ユニットで配信 4 時間ほどしか持たない。公開後に使う人が増えるなら、間隔を延ばす（`MIN_POLL_MS`）か、Google に枠の増加を申請する
- 公開 API の回数制限（[`rate-limit.ts`](./src/lib/rate-limit.ts)）はインスタンスごとのメモリ。荒らしが来たら Redis で全インスタンス共有にする
- 共有カード画像は X の Card Validator などで、本番ドメインで実際に出るか確認する（`NEXT_PUBLIC_SITE_URL` で基準の URL を変えられる）
- 小さな残り: 文の編集を閉じたあと PC でメニューが開いたまま残ることがある（`useMenuHold` の locked）、雑談以外のモードをキー無しで深く広げると 3×3 が埋まりきらない（候補の数が少ない。今は空けておく）、`TopicShowcase` の件数が全モード分、ラジオの矢印キー操作
- ルーレットの演出は盤面の中だけ。いっしょに見る画面・オーバーレイでも回る様子を見せるなら、共有ボードに「回した」を載せる
- カードのメニューから「ずれている」「コピー」を外した（2026-09-30、あまり使われないため）。コピーはショートカット C で残る。「ずれている」の処理（`use-board-controller.ts` の `rejectNode`）は残してあるので、戻すなら `topic-actions-menu.tsx` に項目を足すだけ。使われないままなら処理ごと消す

## 残り: 公開前の図鑑の棚卸しの続き（2026-09-29）

済: 本番の共有図鑑（Redis、388 お題）を棚卸しして、開発中の深掘りで残ったカード文のお題・他モードの試し打ちなど 189 お題を隠し、残したお題のずれた語も語ごとに隠した。分類は表で固定（[`topic-archive-data.ts`](./src/lib/topic-archive-data.ts) の `ARCHIVED_SEEDS` / `BY_SEED` / `CATEGORY_FIXES`。Redis からは消さず、読むときに外す）。同梱の初期データ（[`topic-knowledge-seed-data.ts`](./src/lib/topic-knowledge-seed-data.ts)）は、ずれた語の差し替え・ホームのスターター全部の専用データ・薄い分類のお題・雑談以外のモードのスターター（`SEED_MODE_TOPICS`）を足した。調べて分かった生成の問題は、コード側でも防いだ（[`label-quality.ts`](./src/lib/label-quality.ts): 「…」で切った語を捨てる・同じ書き出しの語を並べない・遠い文脈のお題を記録しない、`topicSimilarity`: 共通の言い回しで似たお題とみなさない、`classifyTopic`: お題名を重く見る）。

- 実キーで、雑談のプロンプトに足した指示（選べる範囲に偏らない・お題を取り違えない・同じ型の語を並べない、[`modes.ts`](./src/lib/modes.ts)）の効き目を確認する。「好きな季節」が夏だけにならないか、「人が来なくて」が配信の話になるか
- リリース後に貯まる分も、同じ手順で棚卸しする: 公開 API を読む（`/api/knowledge?mode=chat&category=food` のようにモード×分類ごと、1回80件まで）→ カード文のお題・ずれた語を `topic-archive-data.ts` に足す。Redis に管理用の書き込み手段はまだ無い
- 1つ離れた文脈で出た長めのカードは、今も単独のお題として記録する（文脈しだいで意味が変わる）。文脈つきで記録する案（親 → 子をキーに含める）は未着手
- 図鑑ページの一覧は全件出す。よく選ばれた・使われたお題を上にする以外の絞り込み（しきい値）は未検討

## 残り: AI の混雑・話題のズレ・掛け合わせ（2026-09-29）

済: 設定の一番下に「AI の利用状況（今日・この端末から）」（[`ai-usage.ts`](./src/lib/ai-usage.ts)。回数・トークン・失敗の理由・直近の失敗と試したモデル）。途中のモデルで「利用枠なし」が出たらそちらを原因として返す（最後のモデルの 503 で「混み合って」と出ていた）。深く広げても最初のお題を文脈に必ず入れ、雑談以外は中心へ寄せる指示（`anchorInstruction`）＋一度だけお知らせ。掛け合わせは持ってきた側のカードの親も渡し（`mixOriginNote`）、よい例・悪い例を追加。

- 503 対策（2026-09-29）: 503 は同じモデルで待ち直さず次のモデルへ。503・時間切れ・一時的な 429 のモデルは 2 分間後回し（`orderByCooldown`、サーバーのインスタンス内だけ）。予備（+4 枚）が足りないだけでは呼び直さない（`minimum`）ので、1 回広げて Gemini 2 回はほぼ無くなるはず。設定の「直近の失敗」で効き目を確認。まだ 503 が多いなら、後回しを Redis で全インスタンス共有にする
- 自分の API キーを入れる方式は未実装（ユーザーは「どうしても難しいなら」）。土台はある: 設定の `geminiApiKey`、`/api/gemini` の `apiKey` 上書き、解説は既に渡している。やるなら設定画面の入力欄＋AI Studio でのキー作成手順＋広げる（`generateRelatedTopics`）へ渡す。キーは端末の localStorage のみ・エクスポートに含めない（`storage.ts` の includeApiKey）
- 線の矢印（[`flow-edge.tsx`](./src/components/flow-edge.tsx)）は放射レイアウトの見た目を未確認（マンダラートだけ見た）
- `/api/gemini` は誰でも呼べる（キー自体は漏れないが、枠は使われうる）。気になるなら Origin チェックや1日の全体上限を足す
- 実キーで、お悩み相談の深い段で中心から離れないか・掛け合わせが両方にまたがるかを確認

## 検討中: AI の待ち時間の演出の続き（2026-09-29）

済: 語が入るとカードの色の花が咲く、10 秒を過ぎたら状況（別の AI に聞き直し中・2 巡目）と和ませる一言をお知らせで出す（[`expand-wait.ts`](./src/lib/expand-wait.ts)、サーバーは NDJSON の `stage` 行で段階を送る）。お知らせはオーバーレイには出さない。

止めたもの（フラグを true に戻せば復活）: 0.18 秒おきに 1 枚ずつ出す（`expand-wait.ts` の `STAGGER_REVEAL`）、空のカードで芽が育つ・語が入ると花が咲く（どちらも `topic-node.tsx` の `SPROUT_WHILE_WAITING`）。体感が微妙だった。

代わりに、待っている 3×3 でピクセルアートの動物が遊ぶ（[`wait-critters.ts`](./src/lib/wait-critters.ts) 種類と選び方 / [`critter-moves.ts`](./src/lib/critter-moves.ts)・[`critter-moves-window.ts`](./src/lib/critter-moves-window.ts) 動き / [`critter-cast.ts`](./src/lib/critter-cast.ts) 絵とコマの対応 / [`wait-critters.tsx`](./src/components/wait-critters.tsx) 画面）。14 種（カエル・ペンギン・うさぎ・ちょうちょ・ひよこの行列・小鳥・リス・金魚・ねこ・いぬ・ハムスター・うま・イルカ・きつねとたぬき）× 2 つのタッチで、待ちごとにランダム。0.7 秒より短い待ちでは出ない。

- かわいい絵（手描きのドット、[`critter-sprites-cute.ts`](./src/lib/critter-sprites-cute.ts)）: カードの上の縁や溝を歩く。金魚・イルカは溝が水路になる。小鳥は待ちが終わると飛び立ち、蝶々は語が入ったばかりのカードに停まってから消える
- リアルな絵（図形で描いて陰影を自動で付ける、[`critter-sprites-real.ts`](./src/lib/critter-sprites-real.ts) + [`pixel-draw.ts`](./src/lib/pixel-draw.ts)）: 空のカードを窓に見立てて、カードの中の床を歩く（語の入ったカードの後ろは見えない）。金魚は水槽、イルカは海になる。作るのに約 90ms かかるので、最初に出るときに作る
- 設定の「待ち時間の動物」で、動物ごとに出す／出さない（`hiddenCritters`）と絵のタッチ（`critterStyle`: おまかせ／かわいい／リアル）
- 確認用: URL に `?critter=rabbit`（かわいい）/ `?critter=rabbit-real` / `?critter=random` を付けると、待っていなくても選んでいる 3×3 に出る（中心以外を空のカードとして扱う）
- ほかの画面（トップの話題・トピック図鑑・みんなが作った話題マップ）でも、見えているカードの一覧の上にほぼいつも誰かいる（[`ambient-critters.ts`](./src/lib/ambient-critters.ts) / [`ambient-critters.tsx`](./src/components/ambient-critters.tsx)、1場面の描画は [`critter-scene.tsx`](./src/components/critter-scene.tsx) を共用）。かわいい絵だけ、金魚・イルカは出さない。ページを開いたときからいて 22〜35 秒遊び、2〜5 秒あけて別の子（カードが見えていなければ 1 秒おきに探す）。一覧に `data-critter-garden`、カードに `data-critter-perch` を付ければ、そこにも来る。`?critter=frog` でその子がすぐ来て帰らない。狭い画面では外周の道が画面の端にかかって半分切れることがある
- 動物を足すときは、`CRITTER_KINDS` と `CRITTER_LABELS` に名前、絵、`critter-cast.ts` に配役、`cutePlanner` / `realPlanner` に動き、`CRITTER_ICONS` にアイコン。テストが「動きが使う絵が配役にあるか」を全種で確かめる

次の候補: かたつむり（カードの縁をゆっくり一周し、通ったあとがきらっと光る）、ホタル（暗いテーマで溝を漂う）、たぬきの「どろん」（葉っぱを頭にのせて煙と一緒に化ける）。実際の待ち（空のカードの骨組みの上）とスマホでの見え方は未確認

未採用の案は次の3つ:

- E. 15 秒を過ぎたら「図鑑から先に出す」ボタン（待つかどうかを配信者が決める）。AI の要求を中断して手元の候補で埋める
- F. 待ち時間を配信のネタに（「どんな話題が出ると思う？コメントで予想してね」をオーバーレイに出し、ライブチャットとつなぐ）
- G. 図鑑の候補を仮のカードで先に出し、AI の語が届いたら入れ替える（話し始めたカードが変わる問題があるので慎重に）

## 残り: 掛け合わせ・スマホ操作（2026-09-27）

済: 掛け合わせ（[`combine.ts`](./src/lib/combine.ts) / [`board-combine.ts`](./src/lib/board-combine.ts) / [`combine-drag.tsx`](./src/components/combine-drag.tsx)）、スマホの下から出るメニュー、左下の抽象展開/具体的 + 使い方（[`mode-dock.tsx`](./src/components/mode-dock.tsx)）、使い方ギャラリー（画像は `node scripts/capture-guide.mjs` で撮り直し）。「…」ボタン案はやめ、長押し中の吹き出し・初回ヒント・? ボタンで代える。

- 実キーで掛け合わせの AI 出力を確認していない（`combineInstruction` の効き目）。片方だけの話に寄るなら指示を強める
- 実機のスマホでの長押し→ドラッグは未確認（ブラウザで PointerEvent を合成して確認しただけ）。盤面のスクロールを止める処理は React Flow が touchmove で動かす前提（[`topic-node.tsx`](./src/components/topic-node.tsx) の touchmove 停止）
- AGENTS.md の入口表に「掛け合わせ」の行を足す（未コミットの手元の変更があったので触っていない）

## 検討中: 分類型のお題の広げ方（2026-09-27）

済: 雑談・学び・「具体的にする」（雑談）のプロンプトに「分け方のあるお題は種類で広げる／一つに絞れたら中身を出す」ルールと例（地方の方言 → 関西弁 → なんでやねん）を追加（[`modes.ts`](./src/lib/modes.ts) の chat / learn、[`detail-modes.ts`](./src/lib/detail-modes.ts) の chat）。抽象展開では 8 枚のうち 1 枚を「地方ごとの方言」のような分け方のカードにし、「〜ごとの / 〜別の / 〜の種類」のカードを広げたときはコード側で「分けた一つ一つを並べる」指示を足す（`isDivisionLabel` / `divisionInstruction`）。実キーでの比較は未実施。

- 「言葉：意味」（ぶち：すごく）: 方言・用語などの言葉のお題（`isWordTopic`）では「具体的にする」で `wordInstruction` を足し、カードは語と意味の 2 段（`splitGloss`、[`node-box.ts`](./src/lib/node-box.ts)）。実キーで広島弁・業界用語などを試して、意味が不確かな言葉や分類名が混ざるなら指示を強める
- 似たお題の語の借り過ぎは直した（共通の言い回しを除いて比べる・お題自身の語が十分なら控えめ。[`topic-knowledge.ts`](./src/lib/topic-knowledge.ts) `topicSimilarity` / `suggestFromKnowledge`）。「地方の方言」が同梱の「地元のイントネーション…」の語を引く件は、実キーで確認
- さらに確実にしたいなら「分けて広げる」をトグル・メニューとして用意する案

## 検討中: 雑談以外のモードのブラッシュアップ（2026-09-26）

- お悩み相談のカードを体言止めでなく、語りかけ・問いかけの短い文にする（例「本当はどうしたい？」「一度休んでみる？」）。`modes.ts` の advice の prompt / angleGroups を直すだけで済む
- 「これって何？」（カードのメニュー → 解説を出して付箋に貼れる。[`explain.ts`](./src/lib/explain.ts) / [`gemini-explain.ts`](./src/lib/gemini-explain.ts) / `api/explain`）: 実キーで解説の正確さ・長さを未確認。キー無しは「言葉：意味」の意味と検索リンクだけ。解説は図鑑に記録しない（まちがいが公開されるのを避ける）
- 「具体的にする」の答え（文）は図鑑に記録していない。精度向上に使うなら、公開せずに集計だけする置き場を別に作る
- カードから新しいボードを作って深掘りする案は、図鑑のお題が「具体的な場面」のような文脈なしの語になりやすいので保留（やるなら元のお題を文脈として記録する）
