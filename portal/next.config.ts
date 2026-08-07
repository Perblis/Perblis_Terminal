import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Token source lives in a workspace package; allow transpiling it.
  transpilePackages: ["@terminal/tokens"],
  // Self-hosted Node runtime (D-027): emit the standalone server that
  // infra/vps/portal.Dockerfile ships. The tracing root spans the pnpm
  // workspace so portal/.next/standalone is self-contained.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
