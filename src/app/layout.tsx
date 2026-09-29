import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_JP } from "next/font/google";

import { AppProviders } from "@/components/app-providers";
import { adConfig } from "@/lib/ads";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";
import "./app-chrome.css";
import "./topic-accents.css";

const notoSans = Noto_Sans_JP({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_TITLE = "TopicStream(ぬ) | 話題が広がるマインドマップ・マンダラートWebサービス";
const SITE_DESCRIPTION =
  "お題をひとつ入れると、話せるネタや考えの切り口を 8 方向に広げるマインドマップ・マンダラート。雑談配信のネタ出しから、お悩み相談・アイデア出し・目標の分解・振り返り・調べものまで。登録不要・無料。";

export const metadata: Metadata = {
  // X などで共有したときのカード画像（opengraph-image.png）を絶対 URL にするための基準。公開先ごとに変えられる
  metadataBase: new URL(siteUrl()),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: ["マインドマップ", "マンダラート", "雑談配信", "話題", "ネタ出し", "アイデア出し", "お悩み相談", "目標設定", "VTuber"],
  openGraph: {
    type: "website",
    siteName: "TopicStream(ぬ)",
    locale: "ja_JP",
    title: "TopicStream(ぬ) | もう、話題に詰まらない。",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "TopicStream(ぬ) | もう、話題に詰まらない。",
    description: SITE_DESCRIPTION,
  },
  // AdSense のサイト所有確認用。ID 未設定なら出さない。
  ...(adConfig.client ? { other: { "google-adsense-account": adConfig.client } } : {}),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      data-theme="fresh"
      suppressHydrationWarning
      className={`${notoSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
