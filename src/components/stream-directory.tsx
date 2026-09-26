"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, MapPinned, Play, Radio } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  mergePublicStreams,
  publicStreamFromLink,
  SEED_PUBLIC_STREAMS,
  streamThumbnailUrl,
  watchMapHref,
  type PublicStream,
} from "@/lib/stream-directory";

export function StreamDirectory({
  linkedUrl,
  linkedTitle,
  linkedStreamer,
  linkedWatchId,
}: {
  linkedUrl?: string;
  linkedTitle?: string;
  linkedStreamer?: string;
  linkedWatchId?: string;
}) {
  const [remote, setRemote] = useState<PublicStream[]>(SEED_PUBLIC_STREAMS);
  const linked = useMemo(
    () =>
      publicStreamFromLink({
        url: linkedUrl ?? "",
        title: linkedTitle,
        streamer: linkedStreamer,
        watchId: linkedWatchId,
      }),
    [linkedStreamer, linkedTitle, linkedUrl, linkedWatchId],
  );
  const streams = useMemo(
    () => mergePublicStreams(SEED_PUBLIC_STREAMS, remote, linked ? [linked] : []),
    [linked, remote],
  );

  useEffect(() => {
    let cancelled = false;
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    void fetch(`${base}/api/streams`)
      .then((response) => response.json())
      .then((json: { streams?: PublicStream[] }) => {
        if (!cancelled && Array.isArray(json.streams) && json.streams.length > 0) {
          setRemote(json.streams);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mt-12 w-full">
      <div className="mb-4 text-center">
        <h2 className="text-lg font-semibold">このサービスを利用している配信</h2>
      </div>
      {streams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 px-4 py-8 text-center">
          <p className="text-sm font-medium">まだ載っている配信はありません</p>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            これから増えていきます。配信で使うときにマップ下へ配信URLを貼ると、ここに載ります。
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {streams.map((stream) => {
            const mapHref = watchMapHref(stream.watchId);
            return (
              <li
                key={stream.id}
                className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/70 p-2 pr-3"
              >
                <StreamThumbnail stream={stream} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <a
                      href={stream.url}
                      target="_blank"
                      rel="noreferrer"
                      className="line-clamp-2 text-sm font-medium leading-snug hover:underline"
                    >
                      {stream.title}
                    </a>
                    {stream.live ? (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Radio className="size-2.5" />
                        ライブ
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        TopicStream
                      </Badge>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {stream.streamer} · {stream.platform === "youtube" ? "YouTube" : "Twitch"}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <a
                    href={stream.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    本配信
                    <ExternalLink className="size-3" />
                  </a>
                  {mapHref ? (
                    <Link
                      href={mapHref}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      マップ
                      <MapPinned className="size-3" />
                    </Link>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** 本配信へのリンクを兼ねたサムネイル。画像が無い・読めないときは YT / TW の札にする */
function StreamThumbnail({ stream }: { stream: PublicStream }) {
  const src = streamThumbnailUrl(stream);
  const [failed, setFailed] = useState(false);
  const platformLabel = stream.platform === "youtube" ? "YouTube" : "Twitch";
  return (
    <a
      href={stream.url}
      target="_blank"
      rel="noreferrer"
      aria-label={`${stream.title}（${platformLabel}で開く）`}
      className="group relative flex aspect-video w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 sm:w-36"
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- 外部のサムネイル。静的エクスポート（Pages）でもそのまま出すため
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <span className="text-xs font-semibold text-primary">{stream.platform === "youtube" ? "YT" : "TW"}</span>
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
        <Play className="size-6 fill-white text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100" />
      </span>
      {stream.live ? (
        <span className="absolute left-1 top-1 rounded bg-red-600 px-1 py-px text-[9px] font-bold leading-tight text-white">
          LIVE
        </span>
      ) : null}
    </a>
  );
}
