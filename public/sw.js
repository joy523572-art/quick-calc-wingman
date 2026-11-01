const CACHE_NAME = "nume-shell-v2";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.png",
  "/placeholder.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/icon-1024.png",
];

const OFFLINE_FALLBACK = "/index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

function isNavigationRequest(request) {
  return request.mode === "navigate" || request.destination === "document";
}

function isSameOriginUrl(url) {
  return url.origin === self.location.origin;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!isSameOriginUrl(url)) return;

  // Always serve the app shell from cache while offline; refresh it when online.
  if (isNavigationRequest(request)) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          await cache.put(OFFLINE_FALLBACK, response.clone());
          return response;
        } catch {
          const cached = await caches.match(OFFLINE_FALLBACK);
          return cached || (await caches.match("/"));
        }
      })(),
    );
    return;
  }

  // Cache app resources aggressively, but never cache cross-origin or non-GET requests.
  const isAppAsset =
    APP_SHELL.some((path) => url.pathname === path) ||
    url.pathname.includes("/assets/") ||
    url.pathname.startsWith("/src/") ||
    ["style", "script", "worker", "image", "font", "manifest"].includes(request.destination);

  if (isAppAsset) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const response = await fetch(request);
          if (response && response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }
          return response;
        } catch {
          return (await caches.match(OFFLINE_FALLBACK)) || (await caches.match("/"));
        }
      })(),
    );
    return;
  }

  // Default network-first fallback for any other same-origin request.
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(request)) || (await caches.match(OFFLINE_FALLBACK));
      }
    })(),
  );
});
