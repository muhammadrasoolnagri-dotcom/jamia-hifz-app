const CACHE_NAME = "digital-hifz-v1";

const APP_FILES = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json",
  "/digital-hifz-icon-192.png",
  "/digital-hifz-icon-512.png"
];

// پہلی بار ایپ کی ضروری فائلیں محفوظ کریں
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_FILES);
    })
  );

  self.skipWaiting();
});

// پرانا کیش ختم کریں
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

// انٹرنیٹ دستیاب نہ ہو تو محفوظ شدہ صفحہ دکھائیں
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // صرف اپنی ویب سائٹ کی GET درخواستیں
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        return response;
      })
      .catch(() => {
        return caches.match(request).then(cachedResponse => {
          return cachedResponse || caches.match("/index.html");
        });
      })
  );
});
