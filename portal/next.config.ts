import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Token source lives in a workspace package; allow transpiling it.
  transpilePackages: ["@terminal/tokens"],
};

export default nextConfig;

// Enable the OpenNext Cloudflare dev shim when running `next dev` so the
// local runtime matches Workers. No-ops outside dev.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
