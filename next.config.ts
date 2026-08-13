import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // archiver тянет Node-нативные зависимости — не бандлим, грузим из
  // node_modules в runtime (только на сервере). Аудио-анализ теперь чистый TS
  // (Convertra-порт), WASM/essentia больше нет.
  serverExternalPackages: ["archiver"],
  experimental: {
    // Bot uploads audio files (up to ~150MB) + artwork PNG. Default 10MB is too small.
    middlewareClientMaxBodySize: 150 * 1024 * 1024,
    // Server Actions (track submission MP3 up to 100MB, Support attachments up to
    // 10MB each) — the default Server Actions body limit is only 1MB.
    serverActions: {
      bodySizeLimit: "120mb",
    },
  },
};

export default nextConfig;
