import { clearHistory } from "@/lib/board-history";
import { getBoardSnapshot, writeBoardSnapshot } from "@/lib/board-store";
import { addFavoriteTopics, loadFavoriteTopics } from "@/lib/favorites";
import { layoutBoard, prefsFromSettings } from "@/lib/layout";
import {
  buildTransferPayload,
  mergeTransferredBoards,
  newTransferCode,
  normalizeTransferCode,
  openTransfer,
  sealTransfer,
  transferId,
  TRANSFER_MAX_CHARS,
} from "@/lib/transfer";

/** unavailable = サーバーの無い公開版（GitHub Pages） */
type Failure = "unavailable" | "rate" | "failed";

export type SendTransferResult =
  | { ok: true; code: string; expiresAt: number; boards: number }
  | { ok: false; reason: Failure | "empty" | "too-large" };

/** この端末のボードと ♡ を暗号化して預け、引き継ぎコードを返す */
export async function sendTransfer(): Promise<SendTransferResult> {
  const payload = buildTransferPayload(getBoardSnapshot().boards, loadFavoriteTopics());
  if (payload.boards.length === 0 && payload.topicFavs.length === 0) return { ok: false, reason: "empty" };
  try {
    const code = newTransferCode();
    const sealed = await sealTransfer(code, payload);
    if (sealed.data.length > TRANSFER_MAX_CHARS) return { ok: false, reason: "too-large" };
    const response = await fetch("/api/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sealed),
    });
    if (response.status === 404) return { ok: false, reason: "unavailable" };
    if (response.status === 413) return { ok: false, reason: "too-large" };
    if (response.status === 429) return { ok: false, reason: "rate" };
    const json = (await response.json().catch(() => null)) as { expiresAt?: unknown } | null;
    if (!response.ok || typeof json?.expiresAt !== "number") return { ok: false, reason: "failed" };
    return { ok: true, code, expiresAt: json.expiresAt, boards: payload.boards.length };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

export type ReceiveTransferResult =
  | { ok: true; added: number; updated: number; kept: number; favs: number }
  | { ok: false; reason: Failure | "code" | "not-found" };

/** 引き継ぎコードで預けた中身を受け取り、この端末のボードと ♡ に足す（今あるものは消さない） */
export async function receiveTransfer(input: string): Promise<ReceiveTransferResult> {
  const code = normalizeTransferCode(input);
  if (!code) return { ok: false, reason: "code" };
  try {
    const response = await fetch(`/api/transfer?id=${await transferId(code)}`, { cache: "no-store" });
    if (response.status === 429) return { ok: false, reason: "rate" };
    const json = (await response.json().catch(() => null)) as { data?: unknown } | null;
    // サーバーの無い公開版は、JSON ではないページが 404 で返る
    if (response.status === 404) return { ok: false, reason: json ? "not-found" : "unavailable" };
    if (!response.ok || typeof json?.data !== "string") return { ok: false, reason: "failed" };
    const payload = await openTransfer(code, json.data);
    if (!payload) return { ok: false, reason: "failed" };

    const snapshot = getBoardSnapshot();
    const merged = mergeTransferredBoards(snapshot.boards, payload.boards);
    const changed = new Set([...merged.added, ...merged.updated]);
    // 受け取ったボードは、この端末の設定（広げかた・文字サイズ）で並べ直す
    const boards = merged.boards.map((board) =>
      changed.has(board.id) ? layoutBoard(board, prefsFromSettings(snapshot.settings, false, board.pinnedNodeId)) : board,
    );
    // まだ何も作っていない端末なら、受け取ったボードを「今のボード」にして、空のままのボードは片付ける
    const active = snapshot.boards.find((board) => board.id === snapshot.activeBoardId);
    const fresh = (!active || active.nodes.length === 0) && Boolean(merged.added[0]);
    if (changed.size > 0) {
      writeBoardSnapshot({
        ...snapshot,
        boards: fresh ? boards.filter((board) => board.id !== active?.id) : boards,
        activeBoardId: fresh ? merged.added[0]! : snapshot.activeBoardId,
      });
    }
    // 置き換えたボードの「1つ戻る」は、前の内容を指しているので捨てる
    for (const id of merged.updated) clearHistory(id);
    return {
      ok: true,
      added: merged.added.length,
      updated: merged.updated.length,
      kept: merged.kept.length,
      favs: addFavoriteTopics(payload.topicFavs),
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
