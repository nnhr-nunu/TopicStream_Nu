import { clientKeyFromHeaders } from "@/lib/gemini-guard";
import { bumpTopic, TOPIC_EVENT_KINDS } from "@/lib/live-store";
import { looksPersonal } from "@/lib/personal-text";
import { createRateLimit, tooManyRequests } from "@/lib/rate-limit";

const perMinute = createRateLimit(60, 60_000);
/** 同じ人が同じ語を 1 時間に数えられる回数（トップの「人気のお題」を 1 人で押し上げられないように） */
const perLabel = createRateLimit(3, 60 * 60_000);

export async function POST(request: Request) {
  const client = clientKeyFromHeaders(request.headers);
  if (!perMinute(client)) return tooManyRequests(30);
  const body = (await request.json().catch(() => null)) as { label?: unknown; kind?: unknown } | null;
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const kind = typeof body?.kind === "string" && (TOPIC_EVENT_KINDS as readonly string[]).includes(body.kind) ? body.kind : "expands";
  if (!label || label.length > 40 || looksPersonal(label)) return Response.json({ ok: false }, { status: 400 });
  if (perLabel(`${client}|${label}`)) bumpTopic(label, kind);
  return Response.json({ ok: true });
}
