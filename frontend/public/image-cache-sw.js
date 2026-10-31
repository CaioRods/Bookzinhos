/* Versioned application shell. Private data and PDFs live in account-scoped IndexedDB. */
importScripts("/precache.js");
const SHELL = "mybooks-shell-" + self.MYBOOKS_SHELL.version;
const IMAGES = "mybooks-images-v2";
self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(self.MYBOOKS_SHELL.files)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("mybooks-shell-") && key !== SHELL).slice(0, -1).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(fetch(request).catch(() => caches.open(SHELL).then(cache => cache.match("/index.html"))));
  } else if (url.origin === self.location.origin && (url.pathname.startsWith("/assets/") || self.MYBOOKS_SHELL.files.includes(url.pathname))) {
    event.respondWith(caches.match(request, { ignoreVary: true, ignoreSearch: !url.pathname.startsWith("/assets/") }).then(saved => saved || fetch(request)));
  } else if (request.destination === "image") {
    event.respondWith(caches.open(IMAGES).then(async cache => {
      const saved = await cache.match(request, { ignoreVary: true }); if (saved) return saved;
      const response = await fetch(request);
      // Images only. API responses and PDFs are not cached by this branch.
      if (response.ok || response.type === "opaque") event.waitUntil(cache.put(request, response.clone()));
      return response;
    }));
  }
});
