import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const ONE_HOUR = 60 * 60;
const ONE_DAY = 24 * ONE_HOUR;
const ONE_WEEK = 7 * ONE_DAY;
const ONE_MONTH = 30 * ONE_DAY;
const ONE_YEAR = 365 * ONE_DAY;

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  workboxOptions: {
    skipWaiting: true,
    importScripts: ["/sw-helpers.js"],
    runtimeCaching: [
      // ---- API routes (most specific first) ----
      // Auth & identity — must always reflect latest server state.
      {
        urlPattern: ({ url }) =>
          url.pathname === "/api/me" || url.pathname.startsWith("/api/auth/"),
        handler: "NetworkFirst",
        options: {
          cacheName: "api-auth",
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 8, maxAgeSeconds: ONE_HOUR },
        },
      },
      // Health endpoint — never cache (used as a heartbeat).
      {
        urlPattern: ({ url }) => url.pathname === "/api/health",
        handler: "NetworkOnly",
      },
      // Data APIs — network first so mutations are immediately visible; falls back to cache when offline.
      {
        urlPattern: ({ url, request, sameOrigin }) =>
          sameOrigin && request.method === "GET" && url.pathname.startsWith("/api/"),
        handler: "NetworkFirst",
        options: {
          cacheName: "api-data",
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 64, maxAgeSeconds: ONE_WEEK },
        },
      },

      // ---- Cross-origin fonts ----
      {
        urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts-webfonts",
          expiration: { maxEntries: 4, maxAgeSeconds: ONE_YEAR },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "google-fonts-stylesheets",
          expiration: { maxEntries: 4, maxAgeSeconds: ONE_WEEK },
        },
      },

      // ---- Static asset types ----
      {
        urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-font-assets",
          expiration: { maxEntries: 4, maxAgeSeconds: ONE_WEEK },
        },
      },
      {
        urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-image-assets",
          expiration: { maxEntries: 64, maxAgeSeconds: ONE_MONTH },
        },
      },
      {
        urlPattern: /\/_next\/image\?url=.+$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "next-image",
          expiration: { maxEntries: 64, maxAgeSeconds: ONE_DAY },
        },
      },
      {
        urlPattern: /\.(?:mp3|wav|ogg)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "static-audio-assets",
          expiration: { maxEntries: 32, maxAgeSeconds: ONE_DAY },
        },
      },
      {
        urlPattern: /\.(?:mp4|webm)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "static-video-assets",
          expiration: { maxEntries: 32, maxAgeSeconds: ONE_DAY },
        },
      },
      {
        urlPattern: /\/_next\/static.+\.js$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "next-static-js-assets",
          expiration: { maxEntries: 64, maxAgeSeconds: ONE_DAY },
        },
      },
      {
        urlPattern: /\.(?:js)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-js-assets",
          expiration: { maxEntries: 48, maxAgeSeconds: ONE_DAY },
        },
      },
      {
        urlPattern: /\.(?:css|less)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-style-assets",
          expiration: { maxEntries: 32, maxAgeSeconds: ONE_DAY },
        },
      },
      {
        urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "next-data",
          expiration: { maxEntries: 32, maxAgeSeconds: ONE_DAY },
        },
      },
      {
        urlPattern: /\.(?:json|xml|csv)$/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "static-data-assets",
          expiration: { maxEntries: 32, maxAgeSeconds: ONE_DAY },
        },
      },

      // ---- Next.js RSC + page navigations ----
      // Prefetch RSC and navigation RSC share one cache so that a link
      // prefetch (Next-Router-Prefetch: 1) populates the same entries that
      // a soft navigation lookup will hit. ignoreSearch lets a cached /trips
      // entry serve /trips?edit=ID — all search params are client-side state.
      {
        urlPattern: ({ request, url, sameOrigin }) =>
          sameOrigin && request.headers.get("RSC") === "1" && !url.pathname.startsWith("/api/"),
        handler: "NetworkFirst",
        options: {
          cacheName: "pages-rsc",
          matchOptions: { ignoreSearch: true },
          expiration: { maxEntries: 32, maxAgeSeconds: ONE_DAY },
        },
      },
      {
        urlPattern: ({ url, sameOrigin }) => sameOrigin && !url.pathname.startsWith("/api/"),
        handler: "NetworkFirst",
        options: {
          cacheName: "pages",
          matchOptions: { ignoreSearch: true },
          expiration: { maxEntries: 32, maxAgeSeconds: ONE_DAY },
        },
      },

      // ---- Catch-all for cross-origin GETs ----
      {
        urlPattern: ({ sameOrigin }) => !sameOrigin,
        handler: "NetworkFirst",
        options: {
          cacheName: "cross-origin",
          networkTimeoutSeconds: 10,
          expiration: { maxEntries: 32, maxAgeSeconds: ONE_HOUR },
        },
      },
    ],
  },
  disable: process.env.NODE_ENV === "development",
  publicExcludes: ["!icons/source.svg"],
});

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  async rewrites() {
    return [{ source: "/uploads/:path*", destination: "/api/static/:path*" }];
  },
};

export default withPWA(nextConfig);
