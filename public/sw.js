// ============================================================
// AttendEase service worker — offline app shell.
//
// Strategy:
//   * Precache the public shell (welcome, login, offline page, icons).
//   * Navigations  -> network-first, fall back to the cached page,
//                     then to the /offline fallback.
//   * Static files -> stale-while-revalidate (instant + self-healing).
//   * /api/*       -> never cached (attendance must be live and
//                     de-duplicated by the server).
//
// Bump VERSION on a new release so old caches are dropped.
// ============================================================

const VERSION = "attendease-v1";

const PRECACHE = [
  "/",
  "/login",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only same-origin GETs are cached.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API traffic (attendance, health, exports).
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(async () => {
          return (await caches.match(request)) || (await caches.match("/offline")) || Response.error();
        }),
    );
    return;
  }

  // Static assets: serve from cache instantly, refresh in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
