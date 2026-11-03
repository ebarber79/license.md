/* Service worker — offline support for Neon Dash.
 * Network-first: online players always get the latest deploy; the cache is the
 * offline fallback and is refreshed on every successful fetch. (Cache-first with
 * a fixed cache name used to pin returning players to an old version.)
 * Bump CACHE when the ASSETS list changes. */
const CACHE = "neondash-v8";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./analytics.js",
  "./ads.js",
  "./progress.js",
  "./engine.js",
  "./music.js",
  "./qrcode.js",
  "./register-sw.js",
  "./manifest.json",
  "./icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const sameOrigin = new URL(e.request.url).origin === self.location.origin;
  if (!sameOrigin) return; // let the browser handle third-party requests
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((cached) =>
        cached || (e.request.mode === "navigate" ? caches.match("./index.html") : Response.error())))
  );
});
