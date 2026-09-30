import { parseImportedBoards } from "@/lib/storage";
import type { Board } from "@/lib/types";

/**
 * 別の端末への引き継ぎ: ボード（付箋も）と ♡ した話題を、短い「引き継ぎコード」で別の端末へ運ぶ。
 *
 * 付箋は自分用のメモなので、読める形ではサーバーへ送らない約束。そこで、ブラウザの中で引き継ぎコードから
 * 鍵を作って暗号化し、サーバーには暗号文と「預かり番号」（コードから作る別の値）だけを預ける。
 * サーバーも運営者も、コードを知らなければ中身を読めない。預かるのは 15 分だけ（transfer-store.ts）。
 * 設定と AI キーは運ばない。
 */
export type TransferPayload = { v: 1; boards: Board[]; topicFavs: string[] };

/** 読みまちがえやすい文字（0 と O、1 と I）を除いた 32 文字 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const CODE_PATTERN = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);
/** 預けられる大きさ（暗号文の文字数）。Upstash の 1 件の上限（約 1MB）に届かないように */
export const TRANSFER_MAX_CHARS = 900_000;
export const TRANSFER_ID_PATTERN = /^[a-f0-9]{32}$/;

const SALT = "topicstream-nu:transfer:v1";
/** 短いコードを総当たりしにくくするための繰り返し回数 */
const ITERATIONS = 150_000;

export function newTransferCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  // 256 は 32 で割り切れるので、どの文字も同じ確率で出る
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

/** 画面に出す形（ABCD-EFGH） */
export function formatTransferCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** 入力されたコードをそろえる（小文字・空白・ハイフン入りでもよい）。形が合わなければ null */
export function normalizeTransferCode(input: string): string | null {
  const code = input
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return CODE_PATTERN.test(code) ? code : null;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** コードから、暗号の鍵と預かり番号を作る（同じコードなら、どの端末でも同じになる） */
async function deriveSecrets(code: string): Promise<{ key: CryptoKey; id: string }> {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey("raw", encoder.encode(code), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(SALT), iterations: ITERATIONS },
      material,
      384,
    ),
  );
  const key = await crypto.subtle.importKey("raw", bits.slice(0, 32), "AES-GCM", false, ["encrypt", "decrypt"]);
  return { key, id: toHex(bits.slice(32, 48)) };
}

/** 預かり番号（サーバーが暗号文を探すための名前。ここからコードや鍵は分からない） */
export async function transferId(code: string): Promise<string> {
  return (await deriveSecrets(code)).id;
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const piped = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

/** 引き継ぐ中身を、コードで暗号化する。data の頭の 1 文字は、縮めたか（g）そのままか（r） */
export async function sealTransfer(code: string, payload: TransferPayload): Promise<{ id: string; data: string }> {
  const { key, id } = await deriveSecrets(code);
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  // ボードの JSON は同じ言葉のくり返しが多いので、縮めてから暗号化する（古いブラウザはそのまま）
  const gzip = typeof CompressionStream !== "undefined";
  const body = gzip ? await pipe(plain, new CompressionStream("gzip")) : plain;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, body));
  const joined = new Uint8Array(iv.length + sealed.length);
  joined.set(iv);
  joined.set(sealed, iv.length);
  return { id, data: `${gzip ? "g" : "r"}${toBase64(joined)}` };
}

/** 預けた暗号文を、コードで元に戻す。コードが違う・壊れているなら null */
export async function openTransfer(code: string, data: string): Promise<TransferPayload | null> {
  try {
    const { key } = await deriveSecrets(code);
    const joined = fromBase64(data.slice(1));
    const body = new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv: joined.slice(0, 12) }, key, joined.slice(12)),
    );
    const plain = data[0] === "g" ? await pipe(body, new DecompressionStream("gzip")) : body;
    return asTransferPayload(JSON.parse(new TextDecoder().decode(plain)));
  } catch {
    return null;
  }
}

/** 受け取った中身を確かめる（壊れたボード・巨大なボードは storage.ts と同じ決まりで直す・捨てる） */
export function asTransferPayload(raw: unknown): TransferPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as { boards?: unknown; topicFavs?: unknown };
  const boards = parseImportedBoards({ boards: value.boards }) ?? [];
  const topicFavs = (Array.isArray(value.topicFavs) ? value.topicFavs : [])
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, 500)
    .map((item) => item.slice(0, 160));
  return boards.length > 0 || topicFavs.length > 0 ? { v: 1, boards, topicFavs } : null;
}

/** 引き継ぐ中身を作る。空のボード（まだ何も広げていない）と、広げている途中の空のカードは運ばない */
export function buildTransferPayload(boards: Board[], topicFavs: string[]): TransferPayload {
  return {
    v: 1,
    boards: boards
      .map((board) => ({ ...board, nodes: board.nodes.filter((node) => !node.data.placeholder) }))
      .filter((board) => board.nodes.length > 0),
    topicFavs,
  };
}

export type BoardMerge = {
  boards: Board[];
  /** 新しく足したボード */
  added: string[];
  /** 受け取った内容で置き換えたボード */
  updated: string[];
  /** 手元の方が新しいので、そのままにしたボード */
  kept: string[];
};

/**
 * 受け取ったボードを手元の一覧に足す。同じボードが両方にあるときは、あとで触った方（updatedAt）を残す
 * （行き来しても、新しい作業を古い内容で上書きしない）
 */
export function mergeTransferredBoards(current: Board[], incoming: Board[]): BoardMerge {
  const mine = new Map(current.map((board) => [board.id, board]));
  const added: string[] = [];
  const updated: string[] = [];
  const kept: string[] = [];
  const replaced = new Map<string, Board>();
  for (const board of incoming) {
    const existing = mine.get(board.id);
    if (!existing) added.push(board.id);
    else if (board.updatedAt > existing.updatedAt) updated.push(board.id);
    else {
      kept.push(board.id);
      continue;
    }
    replaced.set(board.id, board);
  }
  return {
    boards: [
      ...current.map((board) => replaced.get(board.id) ?? board),
      ...incoming.filter((board) => added.includes(board.id)),
    ],
    added,
    updated,
    kept,
  };
}
