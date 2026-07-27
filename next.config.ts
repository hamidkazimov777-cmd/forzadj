import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // archiver тянет Node-нативные зависимости; essentia.js — большой WASM.
  // Не бандлим — грузим из node_modules в runtime (только на сервере).
  serverExternalPackages: ["archiver", "essentia.js"],
};

export default nextConfig;
