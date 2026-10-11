const CACHE_NAME = "isomer-explorer-v5";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./molecule-viewer-3d.js",
  "./chemengine/families/alkane.js",
  "./chemengine/families/alkene-alkyne.js",
  "./chemengine/families/alkene.js",
  "./chemengine/families/alkyne.js",
  "./chemengine/families/alcohol.js",
  "./chemengine/families/amine.js",
  "./chemengine/families/aromatic.js",
  "./chemengine/families/bicyclic.js",
  "./chemengine/families/cycloalkane.js",
  "./chemengine/families/cycloalkene.js",
  "./chemengine/families/diene.js",
  "./chemengine/families/fused-aromatic.js",
  "./chemengine/families/haloalkane.js",
  "./chemengine/families/substituted-alkane.js",
  "./vendor/qrcode.js",
  "./vendor/three.module.min.js",
  "./vendor/three.min.js",
  "./manifest.webmanifest",
  "./assets/favicon.svg",
  "./assets/liquid-logo.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/maskable-512.png",
  "./assets/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
  );
});
