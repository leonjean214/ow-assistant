const CACHE_NAME = "ow-cache-v16";
const OVERFAST_HOST = "overfast-api.tekrop.fr";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/app.js",
  "./src/api.js",
  "./src/counter.js",
  "./src/data.js",
  "./src/dom.js",
  "./src/journal.js",
  "./src/pwa.js",
  "./src/profile.js",
  "./src/recommend-hero.js",
  "./src/router.js",
  "./src/stats.js",
  "./src/styles.css",
  "./src/team.js",
  "./src/theme.js",
  "./data/heroes.json",
  "./data/maps_meta.json",
  "./data/patches.json",
  "./data/workshop.json",
  "./data/counter-notes.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.hostname === OVERFAST_HOST) return;
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isCacheableAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match("./index.html") || await cache.match("./");
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put("./index.html", response.clone());
      return response;
    })
    .catch(() => null);

  return cached || await network || new Response("", { status: 504, statusText: "Offline" });
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || await network || new Response("", { status: 504, statusText: "Offline" });
}

function isCacheableAsset(url) {
  return (
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".json") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico")
  );
}
