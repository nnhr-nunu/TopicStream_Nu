import { clientKeyFromHeaders } from "@/lib/gemini-guard";
import { saveShare } from "@/lib/live-store";
import { createRateLimit, readJsonBody, tooManyRequests } from "@/lib/rate-limit";
import { asBoard } from "@/lib/storage";

/** 配信者の画面は盤面が変わるたびに送る（約 1 秒おき）。それより十分多い回数だけ受け付ける */
const limit = createRateLimit(120, 60_000);
/** Upstash の 1 件の上限（約 1MB）に届かない大きさまで */
const MAX_BODY = 900_000;

export async function POST(request: Request) {
  if (!limit(clientKeyFromHeaders(request.headers))) return tooManyRequests(30);
  const body = await readJsonBody<{ id?: unknown; key?: unknown; board?: unknown; nickname?: unknown }>(request, MAX_BODY);
  if (!body) return Response.json({ error: "ボードが大きすぎるか、形が正しくありません" }, { status: 413 });
  const board = asBoard(body.board);
  if (!board || board.nodes.length === 0) {
    return Response.json({ error: "ボードが空です" }, { status: 400 });
  }
  const result = await saveShare({
    id: typeof body.id === "string" ? body.id : null,
    key: typeof body.key === "string" ? body.key : null,
    board,
    nickname: typeof body.nickname === "string" ? body.nickname.slice(0, 24) : "",
  });
  if (!result.ok) {
    return result.reason === "forbidden"
      ? Response.json({ error: "この共有リンクは書き換えられません" }, { status: 403 })
      : Response.json({ error: "共有を保存できませんでした" }, { status: 503 });
  }
  return Response.json({ id: result.id, key: result.key });
}
