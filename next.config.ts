import type { NextConfig } from "next";

const staticExport = process.env.STATIC_EXPORT === "1";
const basePath =
  (process.env.PAGES_BASE_PATH?.trim() || process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "");
const resolvedBase = staticExport && basePath ? basePath : "";

const nextConfig: NextConfig = {
  output: staticExport ? "export" : undefined,
  trailingSlash: staticExport ? true : undefined,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: resolvedBase,
  },
  ...(resolvedBase ? { basePath: resolvedBase, assetPrefix: resolvedBase } : {}),
  // 以下の 2 つは静的エクスポートでは使えない（headers / rewrites）ので、通常ビルド（Vercel の本番）だけ。
  // - AI の学習への利用は予約する（TDM Reservation Protocol）。GitHub Pages のデモは HTML の meta（layout.tsx）と
  //   /.well-known/tdmrep.json で代わりにする
  // - おとりの道（public/_archive/index.html）は、Next では /_archive が 404 になる（/_archive/ は /_archive へ飛ぶ）ので
  //   index.html へつなぐ。GitHub Pages は /_archive/ のまま index.html を返す
  ...(staticExport
    ? {}
    : {
        headers: async () => [{ source: "/:path*", headers: [{ key: "tdm-reservation", value: "1" }] }],
        rewrites: async () => [{ source: "/_archive", destination: "/_archive/index.html" }],
      }),
};

export default nextConfig;
