import { createId } from "@/lib/ids";
import { saveShare } from "@/lib/live-store";
import { asBoard } from "@/lib/storage";
import type { Board } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    board?: unknown;
    nickname?: string;
  } | null;
  const board = asBoard(body?.board) as Board | null;
  if (!board || board.nodes.length === 0) {
    return Response.json({ error: "ボードが空です" }, { status: 400 });
  }
  const id = body?.id && /^[a-zA-Z0-9_-]{6,40}$/.test(body.id) ? body.id : createId("watch").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
  saveShare(id, board, (body?.nickname ?? "").slice(0, 24));
  return Response.json({ id });
}
