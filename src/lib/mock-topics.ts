import { CHILD_COUNT, LABEL_MAX } from "@/lib/constants";
import { DEFAULT_MODE, MODE_PRESETS, modePreset, type AngleGroup } from "@/lib/modes";
import { STARTER_TOPICS } from "@/lib/starters";
import type { BoardMode } from "@/lib/types";

/** お題ごとの定番の語。オフライン生成と、トピック図鑑の初期データに使う */
export const THEME_MAP: Record<string, string[]> = {
  最近買ってよかったもの: [
    "買って後悔したもの",
    "Amazonでの買い物",
    "ドラッグストアの定番",
    "100均の当たり",
    "コンビニでつい買う",
    "リピートしてるもの",
    "高かったけど満足",
    "安いのに優秀",
  ],
  ヒヤッとした体験: [
    "電車でありがちな",
    "深夜の帰り道",
    "配信事故",
    "パスワード忘れ",
    "ギリギリセーフ",
    "今だから笑える",
    "リスナーのヒヤリ",
    "二度としないこと",
  ],
  昔ハマってたゲーム: [
    "課金しすぎた",
    "クリアできなかった",
    "神曲BGM",
    "友達と徹夜",
    "今はもう無理",
    "リメイクしてほしい",
    "キャラ愛が深い",
    "初めてRTAした",
  ],
  今週の推し活: [
    "ライブの余韻",
    "グッズ開封",
    "沼の深さ",
    "課金事情",
    "布教ポイント",
    "推し変しそう",
    "遠征あるある",
    "リスナーの推し",
  ],
  料理で失敗した話: [
    "塩を入れすぎた",
    "焦げた夜",
    "レシピ無視",
    "意外と成功",
    "コンビニで挽回",
    "得意料理はこれ",
    "食べられない闇",
    "聞きたい失敗談",
  ],
  今欲しいガジェット: [
    "マイク周り",
    "照明の悩み",
    "キーボード沼",
    "スマホ乗り換え",
    "迷ってる理由",
    "中古でもいい",
    "配線が嫌い",
    "これで配信が変わる",
  ],
  雨の日の過ごし方: [
    "鍋が食べたい",
    "窓際でダラダラ",
    "雨音ASMR",
    "洗濯が乾かない",
    "好きな雨曲",
    "外出する派",
    "配信向きの天気",
    "雨の匂い",
  ],
  初配信の思い出: [
    "声が震えた",
    "人が来なくて",
    "タイトルミス",
    "機材トラブル",
    "今見ると恥ずかしい",
    "最初のコメント",
    "続けられた理由",
    "あの頃の自分へ",
  ],
  "地元のイントネーション、他県だと笑われる？": [
    "無意識に出る",
    "直そうとして失敗",
    "イントネーション",
    "通じなかった言葉",
    "リスナーの方言",
    "標準語に戻す",
    "地元だと普通",
    "笑いのポイント",
  ],
  "出身地あるある、急に思い出した": [
    "地元に帰ると",
    "コンビニの違い",
    "電車あるある",
    "説明が長い",
    "空気が変わる",
    "なつかしい店",
    "都会との差",
    "急に思い出す",
  ],
  "最近のマイブーム、まだ人に言ってないやつ": [
    "ひとり趣味",
    "お金が溶ける",
    "放置してる趣味",
    "答えに困る",
    "始めかけ",
    "黙々とやってる",
    "布教していいか",
    "秘密のルーティン",
  ],
  "学生のころの部活、今もネタになる？": [
    "部活の思い出",
    "授業中の内緒",
    "卒業アルバム",
    "テスト前の神",
    "帰り道の変な話",
    "今もネタになる",
    "サークルの話",
    "当時の自分へ",
  ],
  "何度もループしてる曲、ある？": [
    "サビだけ完璧",
    "カラオケ十八番",
    "昔に戻る曲",
    "配信向きの曲",
    "歌詞は忘れる",
    "リピート確定",
    "空気が変わる曲",
    "今も同じ曲",
  ],
  "これだけはゆずれない、ちょっとしたルール": [
    "ちょっと萎える",
    "先にありがとう",
    "流せないこと",
    "貸し借りの感覚",
    "電車マナー",
    "ゆずれない癖",
    "まあいっかの線",
    "自分ルール",
  ],
  "もし配信してなかった自分、何してる？": [
    "名前が変わったら",
    "そっくりな人",
    "運と実力",
    "やり直すなら何日",
    "偶然を信じたい",
    "心と体どっち",
    "声の入れ替わり",
    "もしもの自分",
  ],
};

/**
 * どのお題の下に置いても話せる「切り口」。お題の語をつなげて「昔の〇〇」「〇〇の沼」のように
 * 機械的に作ると芸がないので、カード単体で問いかけとして読める言い回しにしている。
 * 系統ごとに分け、8 マスに同じ系統ばかり並ばないよう 1 つずつ順番に取り出す。
 *
 * 切り口のカード自体を広げたときは、その系統の「深掘り」を先に出す（「一番の失敗談」→「その瞬間どうした」）。
 * 切り口はどのお題にも付くので、元のお題（context）の定番の語・図鑑の語も混ぜて、話が元に戻れるようにする。
 */

const ANGLE_GROUPS: AngleGroup[] = [
  {
    // きっかけ・昔と今
    angles: ["ハマったきっかけ", "最初の印象", "昔と今で変わったこと", "子どものころの記憶", "初めての体験", "ブームが来た瞬間"],
    followUps: ["いつごろの話？", "誰の影響？", "当時の自分に一言", "今も続いてる？", "あのころの流行", "思い出の場所", "変わらないもの", "戻れるなら戻りたい？"],
  },
  {
    // 失敗・本音
    angles: ["一番の失敗談", "正直ここが苦手", "今だから言える本音", "ちょっと恥ずかしい話", "やめられない理由", "やらなきゃよかった"],
    followUps: ["その瞬間どうした", "まわりの反応", "今なら笑える？", "二度としないこと", "実はまだ引きずってる", "同じ経験ある人いる？", "そこから学んだこと", "言い訳させて"],
  },
  {
    // 好み・こだわり
    angles: ["好き嫌いが分かれる所", "ゆずれないこだわり", "高いの vs 安いの", "定番派？変わり種派？", "ひとつだけ選ぶなら", "今年のベスト"],
    followUps: ["そう思う理由", "反対派の言い分", "妥協できるライン", "人生で一番のやつ", "こだわりすぎた話", "人に勧められる？", "最近の推し", "譲ってもいい所"],
  },
  {
    // あるある・まわり
    angles: ["あるあるネタ", "意外と知られてない話", "家族や友達の反応", "地域でちがうこと", "人に勧めるなら", "ハマる人の特徴"],
    followUps: ["身近な実例", "言われて気づいた", "意外な人がハマってた", "ちょっと引かれた話", "地元だとどう？", "ネットで見た話", "リスナーの体験談", "通じなかったこと"],
  },
  {
    // これから・もしも
    angles: ["これからやりたいこと", "もし一生禁止されたら", "理想を言うなら", "10年後はどうなってる", "お金を気にしないなら", "初心者に教えるなら"],
    followUps: ["まず何から始める？", "必要なもの", "一緒にやりたい人", "叶ったら配信で報告", "反対されそう？", "予算はいくら", "期限を決めるなら", "実はもう準備中"],
  },
  {
    // リスナーと話す
    angles: ["リスナーにも聞きたい", "コメントで三択", "みんなの思い出を募集", "リスナーのおすすめ", "聞かれたら困る質問", "まだ誰にも話してない"],
    followUps: ["多かった答え", "意外だった答え", "次の配信で続き", "アンケートにするなら", "ランキングにするなら", "答えにくい人へ", "ベストコメント選手権", "リスナー同士で話す"],
  },
];

/** 深掘りを先に何枚出すか（残りのマスは元のお題の語で埋める） */
const FOLLOW_UP_FIRST = 5;

/** 雑談の系統と、ほかのモードの系統（別のモードの切り口を広げても深掘りが出るよう、探すときは全部見る） */
const ALL_ANGLE_GROUPS: AngleGroup[] = [...ANGLE_GROUPS, ...MODE_PRESETS.flatMap((preset) => preset.angleGroups)];

function angleGroupOf(label: string): AngleGroup | undefined {
  const trimmed = label.trim();
  return ALL_ANGLE_GROUPS.find((group) => group.angles.includes(trimmed) || group.followUps.includes(trimmed));
}

/**
 * どのお題にも付く汎用の切り口・深掘りか。これを広げるときは元のお題の文脈が要るし、
 * 結果を図鑑にこのお題の語として残すと、別のお題のときに混ざってしまう。
 */
export function isGenericAngle(label: string): boolean {
  return Boolean(angleGroupOf(label));
}

/** 文脈（近い祖先から順）のうち、汎用の切り口ではない最初のお題 */
export function topicAnchor(context: string[]): string | undefined {
  return context.map((label) => label.trim()).find((label) => label && !isGenericAngle(label));
}

function themeWordsFor(label: string | undefined): string[] | undefined {
  if (!label) return undefined;
  return THEME_MAP[label] ?? THEME_MAP[Object.keys(THEME_MAP).find((key) => label.includes(key)) ?? ""];
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

function clipLabel(label: string): string {
  const trimmed = label.replace(/\s+/g, " ").trim();
  if (trimmed.length <= LABEL_MAX) return trimmed;
  return `${trimmed.slice(0, LABEL_MAX - 1)}…`;
}

function uniquePush(target: string[], value: string, banned: Set<string>) {
  const label = clipLabel(value);
  if (!label || banned.has(label) || target.includes(label)) return;
  target.push(label);
}

/**
 * キー無し・AI 失敗時の候補。
 * context は広げるカードの祖先（近い順）。related は元のお題について図鑑から引いた語。
 * 並び: 深掘り → 定番の語 → 元のお題の語 → 切り口 → よく使われる話題 → お題の一覧
 */
export function mockRelatedTopics(
  seed: string,
  existing: string[] = [],
  count = CHILD_COUNT,
  preferred: string[] = [],
  { context = [], related = [], mode = DEFAULT_MODE }: { context?: string[]; related?: string[]; mode?: BoardMode } = {},
): string[] {
  if (mode !== DEFAULT_MODE) return modeRelatedTopics(seed, existing, count, context, modePreset(mode).angleGroups);

  const banned = new Set(existing.map((item) => item.trim()).filter(Boolean));
  banned.add(seed.trim());
  for (const label of context) banned.add(label.trim());

  const random = mulberry32(hashString(`${seed}:${existing.join("|")}:${Date.now() % 97}`));
  const picked: string[] = [];
  const anchor = topicAnchor(context);
  const ownGroup = angleGroupOf(seed);
  const followUps = ownGroup ? shuffle(ownGroup.followUps, random) : [];

  for (const item of followUps.slice(0, FOLLOW_UP_FIRST)) {
    uniquePush(picked, item, banned);
  }
  // 切り口のカードなら元のお題の定番の語、そうでなければこのお題（無ければ元のお題）の定番の語
  const mapped = ownGroup ? themeWordsFor(anchor) : (themeWordsFor(seed) ?? themeWordsFor(anchor));
  if (mapped) {
    for (const item of shuffle(mapped, random)) {
      uniquePush(picked, item, banned);
    }
  }
  for (const item of related) {
    uniquePush(picked, item, banned);
  }
  for (const item of followUps.slice(FOLLOW_UP_FIRST)) {
    uniquePush(picked, item, banned);
  }

  // 系統をシャッフルし、各系統から 1 つずつ順に取り出す（同じ系統が固まらない）
  const groups = shuffle(
    ANGLE_GROUPS.filter((group) => group !== ownGroup),
    random,
  ).map((group) => shuffle(group.angles, random));
  const longest = Math.max(...groups.map((group) => group.length));
  for (let round = 0; round < longest; round += 1) {
    for (const group of groups) {
      const angle = group[round];
      if (angle) uniquePush(picked, angle, banned);
    }
  }

  // よく使われる話題（preferred）とお題の一覧は、このお題と関係が無いので最後の埋め草にする
  for (const item of preferred) {
    uniquePush(picked, item, banned);
  }
  const unusedStarters = shuffle(
    STARTER_TOPICS.filter((topic) => topic !== seed),
    random,
  );
  for (const starter of unusedStarters) {
    uniquePush(picked, starter, banned);
  }

  return picked.slice(0, count);
}

/**
 * 雑談以外のモードの候補。そのモードの系統だけから出す
 * （雑談の定番の語・図鑑・お題の一覧は、相談や目標のカードには合わないので混ぜない）。
 */
function modeRelatedTopics(
  seed: string,
  existing: string[],
  count: number,
  context: string[],
  modeGroups: AngleGroup[],
): string[] {
  const banned = new Set(existing.map((item) => item.trim()).filter(Boolean));
  banned.add(seed.trim());
  for (const label of context) banned.add(label.trim());

  const random = mulberry32(hashString(`${seed}:${existing.join("|")}:${Date.now() % 97}`));
  const picked: string[] = [];
  // 「最初の一歩」のように複数のモードにある切り口は、今のモードの深掘りを出す
  const trimmed = seed.trim();
  const ownGroup =
    modeGroups.find((group) => group.angles.includes(trimmed) || group.followUps.includes(trimmed)) ?? angleGroupOf(seed);
  if (ownGroup) {
    for (const item of shuffle(ownGroup.followUps, random)) uniquePush(picked, item, banned);
  }
  const groups = shuffle(
    modeGroups.filter((group) => group !== ownGroup),
    random,
  ).map((group) => shuffle(group.angles, random));
  const longest = Math.max(0, ...groups.map((group) => group.length));
  for (let round = 0; round < longest; round += 1) {
    for (const group of groups) {
      const angle = group[round];
      if (angle) uniquePush(picked, angle, banned);
    }
  }
  // 深い所まで広げて系統を使い切ったら、深掘りの問いで埋める
  for (const group of shuffle(modeGroups, random)) {
    for (const item of group.followUps) uniquePush(picked, item, banned);
  }
  return picked.slice(0, count);
}
