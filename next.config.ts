import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  workboxOptions: { skipWaiting: true, importScripts: ["/sw-helpers.js"] },
  disable: process.env.NODE_ENV === "development",
  publicExcludes: ["!icons/source.svg"],
});

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  async rewrites() {
    return [
      { source: "/uploads/:path*", destination: "/api/static/:path*" },
    ];
  },
};

export default withPWA(nextConfig);
