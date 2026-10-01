import { clientKeyFromHeaders } from "@/lib/gemini-guard";
import { saveShare } from "@/lib/live-store";
import { createRateLimit, readJsonBody, tooManyRequests } from "@/lib/rate-limit";
import { asBoard, withoutMemos } from "@/lib/storage";

/** 配信者の画面は盤面が変わるたびに送る（約 1 秒おき）。それより十分多い回数だけ受け付ける */
const limit = createRateLimit(120, 60_000);
/** 新しい共有リンクを作れる回数（配信のたびに 1 つ作るくらい。1 人で保存先を埋められないように） */
const createLimit = createRateLimit(10, 60 * 60_000);
/** Upstash の 1 件の上限（約 1MB）に、保存するときの書き直し（引用符のエスケープ）を足しても届かない大きさまで */
const MAX_BODY = 700_000;

export async function POST(request: Request) {
  const client = clientKeyFromHeaders(request.headers);
  if (!limit(client)) return tooManyRequests(30);
  const body = await readJsonBody<{ id?: unknown; key?: unknown; board?: unknown; nickname?: unknown; chat?: unknown }>(request, MAX_BODY);
  if (!body) return Response.json({ error: "ボードが大きすぎるか、形が正しくありません" }, { status: 413 });
  // 付箋は自分用。古い画面・別のクライアントから送られても残さない
  const parsed = asBoard(body.board);
  const board = parsed ? withoutMemos(parsed) : null;
  if (!board || board.nodes.length === 0) {
    return Response.json({ error: "ボードが空です" }, { status: 400 });
  }
  const result = await saveShare({
    id: typeof body.id === "string" ? body.id : null,
    key: typeof body.key === "string" ? body.key : null,
    board,
    nickname: typeof body.nickname === "string" ? body.nickname.slice(0, 24) : "",
    chat: body.chat === true,
    allowCreate: () => createLimit(client),
  });
  if (!result.ok) {
    if (result.reason === "forbidden") return Response.json({ error: "この共有リンクは書き換えられません" }, { status: 403 });
    if (result.reason === "limited") return tooManyRequests(10 * 60);
    return Response.json({ error: "共有を保存できませんでした" }, { status: 503 });
  }
  return Response.json({ id: result.id, key: result.key });
}
