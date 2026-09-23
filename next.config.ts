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
};

export default nextConfig;
