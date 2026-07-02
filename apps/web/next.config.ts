import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // youtubei.js / googlevideo / bgutils-js / jsdom are heavy Node-only packages
  // used by the keyless YouTube playback fallback (src/lib/youtube.ts). Keep them
  // external so Next doesn't try to bundle them into the serverless function
  // (jsdom in particular breaks bundling).
  serverExternalPackages: ["youtubei.js", "googlevideo", "bgutils-js", "jsdom"],
};

export default nextConfig;
