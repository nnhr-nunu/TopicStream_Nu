export const STARTER_TOPICS = [
  "最近買ってよかったもの",
  "ヒヤッとした体験",
  "昔ハマってたゲーム",
  "今週の推し活",
  "朝起きて最初にすること",
  "好きな季節の過ごし方",
  "料理で失敗した話",
  "深夜に無性に食べたくなるもの",
  "子どものころの習い事",
  "今欲しいガジェット",
  "リスナーに聞きたいこと",
  "最近見たアニメ",
  "旅行したい場所",
  "苦手な食べ物",
  "雨の日の過ごし方",
  "初配信の思い出",
  "コラボしてみたい人",
  "今月の小さな目標",
  "コレクションしているもの",
  "最近のマイブーム",
  "眠れない夜にすること",
  "好きな声・好きな音",
  "コンビニの新作",
  "夏と冬どっち派",
  "配信中のルーティン",
  "恥ずかしかった話",
  "最近の節約術",
  "ペット・ぬいぐるみの話",
  "好きなBGM",
  "今年いちばん笑ったこと",
] as const;

export function pickRandomStarter(exclude: string[] = []): string {
  const pool = STARTER_TOPICS.filter((topic) => !exclude.includes(topic));
  const source = pool.length > 0 ? pool : STARTER_TOPICS;
  return source[Math.floor(Math.random() * source.length)]!;
}
