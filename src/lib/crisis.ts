/**
 * 重い話題（死にたい・自傷など）のときに出す相談窓口。
 * 正本は哲マロの shared/crisis.ts。番号と時間は厚生労働省「まもろうよ こころ」の電話相談のページ
 * （https://www.mhlw.go.jp/mamorouyokokoro/soudan/tel/）で 2026-10-16 に確かめた（いのちの電話の毎月 10 日を足した）。
 */

/** 人が書いたお題（ホームの入力・マップの最初のお題）を見る言葉。哲マロの判定から「首を」だけ「首を吊」に狭めた（「首を寝違えた」で出ないように） */
const INPUT_PATTERNS: readonly RegExp[] = [
  /死にたい/,
  /消えたい/,
  /いなくなりたい/,
  /生きていたくない/,
  /生きるのが(つらい|辛い|しんどい)/,
  /自殺/,
  /自死/,
  /自傷/,
  /リスカ|リストカット|アムカ/,
  /オーバードーズ|\bOD\b/,
  /首を?吊/,
  /飛び降り/,
  /虐待/,
  /殴られ|暴力を(振|ふ)るわれ/,
  /\bDV\b/,
];

/**
 * AI が出したカードを見る言葉。カードには「ボスに殴られた話」「崖から飛び降りる」のような遊びの語も出るので、
 * 言葉だけで重いと決められるものに絞る
 */
const CARD_PATTERNS: readonly RegExp[] = [
  /死にたい/,
  /消えたい/,
  /いなくなりたい/,
  /生きていたくない/,
  /生きるのが(つらい|辛い|しんどい)/,
  /自殺/,
  /自死/,
  /自傷/,
  /リスカ|リストカット|アムカ/,
];

export function looksCrisis(text: string): boolean {
  return INPUT_PATTERNS.some((re) => re.test(text));
}

export function looksCrisisCard(text: string): boolean {
  return CARD_PATTERNS.some((re) => re.test(text));
}

/** 最初のお題は人が書いた言葉として、ほかのカードは AI の語として見る */
export function boardLooksCrisis(nodes: readonly { data: { label: string; parentId: string | null } }[]): boolean {
  return nodes.some((node) => (node.data.parentId === null ? looksCrisis(node.data.label) : looksCrisisCard(node.data.label)));
}

export const HOTLINES: readonly { name: string; tel?: string; hours: string; url: string }[] = [
  { name: "#いのちSOS", tel: "0120-061-338", hours: "24時間", url: "https://www.lifelink.or.jp/inochisos/" },
  { name: "よりそいホットライン", tel: "0120-279-338", hours: "24時間", url: "https://www.since2011.net/yorisoi/" },
  { name: "いのちの電話", tel: "0120-783-556", hours: "毎日16時〜21時（毎月10日は8時〜翌8時）", url: "https://www.inochinodenwa.org/" },
  { name: "24時間子供SOSダイヤル", tel: "0120-0-78310", hours: "24時間", url: "https://www.mext.go.jp/a_menu/shotou/seitoshidou/06112210.htm" },
  { name: "まもろうよ こころ（SNS・チャットの相談も）", hours: "窓口ごと", url: "https://www.mhlw.go.jp/mamorouyokokoro/" },
];
