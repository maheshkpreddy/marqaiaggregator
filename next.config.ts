import type { NextConfig } from "next";

// On Vercel, do NOT use `output: "standalone"` — Vercel has its own output
// tracing and the standalone build conflicts with it. We only enable
// standalone for local/Docker production runs (see `bun run start`).
const isVercel = Boolean(process.env.VERCEL);

const nextConfig: NextConfig = {
  ...(isVercel ? {} : { output: "standalone" }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
