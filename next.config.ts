import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // archiver тянет Node-нативные зависимости — не бандлим, грузим в runtime.
  serverExternalPackages: ["archiver"],
};

export default nextConfig;
