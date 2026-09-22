import { bumpTopic } from "@/lib/live-store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { label?: string; kind?: string } | null;
  const label = body?.label?.trim();
  const kind = body?.kind ?? "expands";
  if (!label) return Response.json({ ok: false }, { status: 400 });
  bumpTopic(label, kind);
  return Response.json({ ok: true });
}
