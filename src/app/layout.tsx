import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_JP } from "next/font/google";

import { AppProviders } from "@/components/app-providers";
import "./globals.css";
import "./app-chrome.css";

const notoSans = Noto_Sans_JP({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TopicStream",
  description: "雑談配信向けの話題マインドマップ。クリックで関連トークが広がります。",
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
