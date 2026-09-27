# TopicStream タスク一覧（未完了のみ）

完了の詳細は `git log`。制約はエージェント用の [`AGENTS.md`](./AGENTS.md)。

## 残り: 掛け合わせ・スマホ操作（2026-09-27）

済: 掛け合わせ（[`combine.ts`](./src/lib/combine.ts) / [`board-combine.ts`](./src/lib/board-combine.ts) / [`combine-drag.tsx`](./src/components/combine-drag.tsx)）、スマホの下から出るメニュー、左下の抽象展開/具体的 + 使い方（[`mode-dock.tsx`](./src/components/mode-dock.tsx)）、使い方ギャラリー（画像は `node scripts/capture-guide.mjs` で撮り直し）。「…」ボタン案はやめ、長押し中の吹き出し・初回ヒント・? ボタンで代える。

- 実キーで掛け合わせの AI 出力を確認していない（`combineInstruction` の効き目）。片方だけの話に寄るなら指示を強める
- X 投稿の話題の軌跡画像（[`trail-image.ts`](./src/lib/trail-image.ts)）では、掛け合わせのカードは重ねた先の子としてだけ描かれる（持ってきた側からの線は無い。文に「A × B」が入るので読めはする）。流れの図に 2 本目の線を描くなら `topic-trail.ts` に mixedFromId を渡す
- 実機のスマホでの長押し→ドラッグは未確認（ブラウザで PointerEvent を合成して確認しただけ）。盤面のスクロールを止める処理は React Flow が touchmove で動かす前提（[`topic-node.tsx`](./src/components/topic-node.tsx) の touchmove 停止）
- AGENTS.md の入口表に「掛け合わせ」の行を足す（未コミットの手元の変更があったので触っていない）

## 検討中: 分類型のお題の広げ方（2026-09-27）

済: 雑談・学び・「具体的にする」（雑談）のプロンプトに「分け方のあるお題は種類で広げる／一つに絞れたら中身を出す」ルールと例（地方の方言 → 関西弁 → なんでやねん）を追加（[`modes.ts`](./src/lib/modes.ts) の chat / learn、[`detail-modes.ts`](./src/lib/detail-modes.ts) の chat）。抽象展開では 8 枚のうち 1 枚を「地方ごとの方言」のような分け方のカードにし、「〜ごとの / 〜別の / 〜の種類」のカードを広げたときはコード側で「分けた一つ一つを並べる」指示を足す（`isDivisionLabel` / `divisionInstruction`）。実キーでの比較は未実施。

- 残り（効き目が足りなければ）: 図鑑が似たお題の語を借りすぎる。「地方の方言」は分類ボーナス（`classifyTopic` の memory、[`topic-knowledge.ts`](./src/lib/topic-knowledge.ts) `relatedEntries`）で同梱の「地元のイントネーション…」の「地元だと普通」「標準語に戻す」を引く。似たお題からの借用は分類ボーナスを下げるか最低ラインを上げる
- さらに確実にしたいなら「分けて広げる」をトグル・メニューとして用意する案

## 検討中: 雑談以外のモードのブラッシュアップ（2026-09-26）

- お悩み相談のカードを体言止めでなく、語りかけ・問いかけの短い文にする（例「本当はどうしたい？」「一度休んでみる？」）。`modes.ts` の advice の prompt / angleGroups を直すだけで済む
- 「具体的にする」の答え（文）は図鑑に記録していない。精度向上に使うなら、公開せずに集計だけする置き場を別に作る
- カードから新しいボードを作って深掘りする案は、図鑑のお題が「具体的な場面」のような文脈なしの語になりやすいので保留（やるなら元のお題を文脈として記録する）
