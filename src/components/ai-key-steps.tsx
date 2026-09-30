import { AI_STUDIO_KEY_URL } from "@/lib/ai-key";

/**
 * 自分の AI キー（Gemini の API キー）の作り方。設定画面と使い方ページの両方に出す。
 * Google の画面は変わることがあるので、ボタンは日本語と英語の両方の名前で書く
 */
export function AiKeySteps({ detailed = false }: { detailed?: boolean }) {
  return (
    <>
      <ol className="list-decimal space-y-1.5 pl-5">
        <li>
          <a href={AI_STUDIO_KEY_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">
            Google AI Studio の「API キー」のページ
          </a>
          を開き、ふだん使っている Google アカウントでログインする
          {detailed ? "（Gmail や YouTube と同じアカウントで大丈夫です）" : null}
        </li>
        <li>
          はじめて開いたときは、利用規約が出るので同意する
          {detailed ? "（同意すると、最初のキーが自動で作られていることがあります。その場合は 4 へ）" : null}
        </li>
        <li>
          <b>「API キーを作成」</b>（英語なら Create API key）を押す。プロジェクトを聞かれたら、出てきたものをそのまま選べば OK
        </li>
        <li>
          できたキー（長い英数字）の横にある<b>コピーのボタン</b>を押す
        </li>
        <li>
          TopicStream の<b>設定（歯車のボタン）→「自分の AI キー」</b>の欄に貼り付けて、<b>接続テスト</b>を押す。
          「つながりました」と出たら完了
        </li>
      </ol>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
        <li>無料枠の中で使うぶんには、料金はかかりません（支払い方法を登録しなければ、請求されることはありません）</li>
        <li>
          キーはパスワードと同じです。<b>人に教えない・配信画面に映さない</b>でください（入力欄は ●●● で隠れます）
        </li>
        <li>
          キーはこのブラウザにだけ保存します。書き出しや引き継ぎには含めません。話題を広げるときだけ、TopicStream
          のサーバーを通って Google へ送られ、サーバーには残しません
        </li>
        <li>無料枠では、AI に送ったお題が Google のサービス改善に使われることがあります</li>
        <li>Google AI Studio は 18 歳以上が対象です</li>
        {detailed ? (
          <li>
            やめたいときは、設定の欄を空にすれば元（みんなで分け合う枠）に戻ります。キーそのものを無効にしたいときは、作ったときと同じページで削除できます
          </li>
        ) : null}
      </ul>
    </>
  );
}
