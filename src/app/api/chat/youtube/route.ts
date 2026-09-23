import { parseStreamUrl } from "@/lib/stream-url";

type YoutubeMessage = { id: string; text: string };

/** 画面に出す読み取りの状態。kind で色と文言を決める。 */
export type YoutubeChatProblem = "no-key" | "not-live" | "quota" | "forbidden" | "ended" | "network";

/**
 * liveChat/messages は1回5ユニット。1日1万ユニットの枠を2時間ほどで使い切らないよう、
 * YouTube が指定する間隔より短くは読まない。
 */
const MIN_POLL_MS = 8_000;

export async function GET() {
  return Response.json({ configured: Boolean(process.env.YOUTUBE_API_KEY?.trim()) });
}

function problem(kind: YoutubeChatProblem, warning: string, retryMs: number, detail?: string) {
  return Response.json({ messages: [] as YoutubeMessage[], problem: kind, warning, retryMs, detail });
}

async function googleReason(response: Response): Promise<{ reason: string; message: string }> {
  const json = (await response.json().catch(() => null)) as {
    error?: { message?: string; errors?: { reason?: string }[] };
  } | null;
  return {
    reason: json?.error?.errors?.[0]?.reason ?? `http-${response.status}`,
    message: (json?.error?.message ?? "").replace(/key=[^&\s]+/g, "key=***").slice(0, 160),
  };
}

function classify(reason: string): { kind: YoutubeChatProblem; warning: string; retryMs: number } {
  if (/quota|rateLimit/i.test(reason)) {
    return { kind: "quota", warning: "YouTube API の今日の利用枠を使い切りました（日本時間の16〜17時ごろに戻ります）。", retryMs: 5 * 60_000 };
  }
  if (/liveChatEnded|liveChatDisabled/i.test(reason)) {
    return { kind: "ended", warning: "この配信のチャットは終了しているか、オフになっています。", retryMs: 60_000 };
  }
  if (/forbidden|keyInvalid|accessNotConfigured|ipRefererBlocked|badRequest/i.test(reason)) {
    return {
      kind: "forbidden",
      warning: "サーバーの YouTube キーでチャットを読めません（キーの制限か、YouTube Data API が無効）。",
      retryMs: 5 * 60_000,
    };
  }
  return { kind: "network", warning: "YouTube のチャットを読めませんでした。少しして読み直します。", retryMs: 20_000 };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    url?: unknown;
    pageToken?: unknown;
    liveChatId?: unknown;
  } | null;
  const url = typeof body?.url === "string" ? body.url : "";
  const ref = parseStreamUrl(url);
  if (!ref || ref.kind !== "youtube") {
    return Response.json({ error: "YouTubeの配信URLではありません" }, { status: 400 });
  }
  // キーはサーバーの環境変数だけ（利用者に入力させない）
  const apiKey = process.env.YOUTUBE_API_KEY?.trim() || "";
  if (!apiKey) {
    return problem("no-key", "この公開版には YouTube のキーが設定されていません。テストコメントで試せます。", 5 * 60_000);
  }

  try {
    // 配信のチャットIDは一度調べたら画面側で覚えておき、毎回は調べない（1ユニット節約）
    let chatId = typeof body?.liveChatId === "string" ? body.liveChatId : "";
    if (!chatId) {
      const details = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${encodeURIComponent(ref.videoId)}&key=${encodeURIComponent(apiKey)}`,
      );
      if (!details.ok) {
        const { reason, message } = await googleReason(details);
        const info = classify(reason);
        return problem(info.kind, info.warning, info.retryMs, `${reason} ${message}`.trim());
      }
      const detailJson = (await details.json()) as {
        items?: { liveStreamingDetails?: { activeLiveChatId?: string; actualEndTime?: string } }[];
      };
      const item = detailJson.items?.[0];
      if (!item) return problem("not-live", "この URL の動画が見つかりません。URL を確認してください。", 60_000);
      chatId = item.liveStreamingDetails?.activeLiveChatId ?? "";
      if (!chatId) {
        return item.liveStreamingDetails?.actualEndTime
          ? problem("ended", "この配信は終了しています。", 5 * 60_000)
          : problem("not-live", "まだライブチャットが開いていません。配信が始まると自動で読み始めます。", 30_000);
      }
    }

    const chatUrl = new URL("https://www.googleapis.com/youtube/v3/liveChat/messages");
    chatUrl.searchParams.set("liveChatId", chatId);
    chatUrl.searchParams.set("part", "snippet");
    chatUrl.searchParams.set("key", apiKey);
    const token = typeof body?.pageToken === "string" ? body.pageToken : "";
    if (token) chatUrl.searchParams.set("pageToken", token);
    const chat = await fetch(chatUrl);
    if (!chat.ok) {
      const { reason, message } = await googleReason(chat);
      const info = classify(reason);
      return Response.json({
        messages: [] as YoutubeMessage[],
        problem: info.kind,
        warning: info.warning,
        retryMs: info.retryMs,
        detail: `${reason} ${message}`.trim(),
        // チャットが終わったら ID を捨てて調べ直す
        liveChatId: info.kind === "ended" ? undefined : chatId,
      });
    }
    const chatJson = (await chat.json()) as {
      nextPageToken?: string;
      pollingIntervalMillis?: number;
      items?: { id?: string; snippet?: { displayMessage?: string } }[];
    };
    const messages: YoutubeMessage[] = (chatJson.items ?? [])
      .map((item) => ({ id: String(item.id ?? ""), text: String(item.snippet?.displayMessage ?? "") }))
      .filter((item) => item.text);
    return Response.json({
      messages,
      liveChatId: chatId,
      nextPageToken: chatJson.nextPageToken,
      pollingMs: Math.max(MIN_POLL_MS, chatJson.pollingIntervalMillis ?? MIN_POLL_MS),
    });
  } catch {
    return problem("network", "YouTube に届きませんでした。少しして読み直します。", 20_000);
  }
}
