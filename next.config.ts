import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // archiver тянет Node-нативные зависимости; essentia.js — большой WASM.
  // Не бандлим — грузим из node_modules в runtime (только на сервере).
  serverExternalPackages: ["archiver", "essentia.js"],
  experimental: {
    // Bot uploads audio files (up to ~150MB) + artwork PNG. Default 10MB is too small.
    middlewareClientMaxBodySize: 150 * 1024 * 1024,
  },
};

export default nextConfig;
