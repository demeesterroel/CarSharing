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

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy. `unsafe-inline` is required for Next.js' bootstrap
// scripts and the app's inline styles; `unsafe-eval` is only needed by the dev
// server (HMR). Map tiles load as <img> from CARTO; the reverse-geocode call
// goes to Nominatim. Everything else is same-origin.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self' https://nominatim.openstreetmap.org",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

// Applied to every response. The CSP is attached separately so it can skip the
// dev-only Scalar API docs page, which relies on inline/CDN scripts.
const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), geolocation=(self)" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

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
  async headers() {
    return [
      { source: "/:path*", headers: baseSecurityHeaders },
      // Strict CSP everywhere except the /docs API reference page.
      { source: "/((?!docs).*)", headers: [{ key: "Content-Security-Policy", value: csp }] },
    ];
  },
};

export default withPWA(nextConfig);
