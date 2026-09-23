import { parseStreamUrl } from "@/lib/stream-url";

type YoutubeMessage = { id: string; text: string };

export async function GET() {
  return Response.json({
    configured: Boolean(process.env.YOUTUBE_API_KEY?.trim()),
    hint: "YouTubeのライブチャットは YOUTUBE_API_KEY か設定のキーが必要です。Twitchはブラウザから匿名で読めます。キーなしならテストコメントを使ってください。",
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    url?: unknown;
    apiKey?: unknown;
    pageToken?: unknown;
  } | null;
  const url = typeof body?.url === "string" ? body.url : "";
  const ref = parseStreamUrl(url);
  if (!ref || ref.kind !== "youtube") {
    return Response.json({ error: "YouTubeの配信URLではありません" }, { status: 400 });
  }
  const apiKey =
    (typeof body?.apiKey === "string" ? body.apiKey.trim() : "") || process.env.YOUTUBE_API_KEY?.trim() || "";
  if (!apiKey) {
    return Response.json({
      messages: [] as YoutubeMessage[],
      warning: "YouTubeキーがないので、下のテストコメントで確認してください。",
    });
  }

  const details = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${encodeURIComponent(ref.videoId)}&key=${encodeURIComponent(apiKey)}`,
  );
  if (!details.ok) {
    return Response.json({ messages: [], warning: "YouTubeに届きませんでした。テストコメントが使えます。" });
  }
  const detailJson = (await details.json()) as {
    items?: { liveStreamingDetails?: { activeLiveChatId?: string } }[];
  };
  const chatId = detailJson.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
  if (!chatId) {
    return Response.json({ messages: [], warning: "いまライブチャットが開いていません。テストコメントが使えます。" });
  }
  const token = typeof body?.pageToken === "string" ? body.pageToken : "";
  const chatUrl = new URL("https://www.googleapis.com/youtube/v3/liveChat/messages");
  chatUrl.searchParams.set("liveChatId", chatId);
  chatUrl.searchParams.set("part", "snippet,authorDetails");
  chatUrl.searchParams.set("key", apiKey);
  if (token) chatUrl.searchParams.set("pageToken", token);
  const chat = await fetch(chatUrl);
  if (!chat.ok) {
    return Response.json({ messages: [], warning: "チャットを読めませんでした。" });
  }
  const chatJson = (await chat.json()) as {
    nextPageToken?: string;
    pollingIntervalMillis?: number;
    items?: { id?: string; snippet?: { displayMessage?: string } }[];
  };
  const messages: YoutubeMessage[] = (chatJson.items ?? [])
    .map((item) => ({
      id: String(item.id ?? ""),
      text: String(item.snippet?.displayMessage ?? ""),
    }))
    .filter((item) => item.text);
  return Response.json({
    messages,
    nextPageToken: chatJson.nextPageToken,
    pollingMs: chatJson.pollingIntervalMillis ?? 5000,
  });
}
