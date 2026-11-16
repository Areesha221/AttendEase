import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (PPR) is off on purpose: this dashboard reads live data
  // from the database on every request, so classic dynamic rendering is simpler
  // and more predictable than wrapping each data section in Suspense.
  cacheComponents: false,
  // Ship the SQL schema with the serverless function. The app reads it at
  // runtime to create/upgrade tables on first request (including Turso).
  outputFileTracingIncludes: {
    "/**/*": ["./lib/schema.sql"],
  },
  // Native offline support (v16): detects connectivity, retries blocked
  // navigation / prefetch / Server Action requests when the network returns,
  // and exposes the `useOffline` hook from `next/offline`.
  experimental: {
    useOffline: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        // The service worker must never be cached, or clients can get stuck
        // on an old version.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
