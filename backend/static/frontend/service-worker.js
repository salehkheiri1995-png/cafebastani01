// سرویس‌ورکر کافه‌بستنی
// - منو: کش stale-while-revalidate (باز شدن سریع حتی آفلاین)
// - صفحات: network-first با فال‌بک به کش (کاربر آفلاین هم به اپ می‌رسد)
// - فایل‌های build شده: cache-first (نام‌شان hash دارد و تغییر نمی‌کند)
const VERSION = "v4";
const STATIC_CACHE = `cafe-static-${VERSION}`;
const MENU_CACHE = `cafe-menu-${VERSION}`;

const MENU_URL = "/api/menu";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // پیش‌بارگذاری منابع حیاتی — شکستشان مانع نصب نمی‌شود
      Promise.allSettled([
        cache.add("/manifest.json"),
        cache.add("/icon-192.png"),
        cache.add("/icon-512.png"),
      ])
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n !== STATIC_CACHE && n !== MENU_CACHE)
            .map((n) => caches.delete(n))
        )
      )
      // پاکسازی فایل‌های build قدیمی (/assets/…) تا نسخهٔ جدید از نو کش شود؛
      // شل ناوبری و آیکون‌ها برای حالت آفلاین دست‌نخورده می‌مانند
      .then(() => caches.open(STATIC_CACHE))
      .then((cache) =>
        cache
          .keys()
          .then((requests) =>
            Promise.all(
              requests
                .filter((req) => new URL(req.url).pathname.startsWith("/assets/"))
                .map((req) => cache.delete(req))
            )
          )
      )
      .then(() => self.clients.claim())
  );
});

/** کش stale-while-revalidate برای منو */
async function menuWithCache(request) {
  const cache = await caches.open(MENU_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      // 200 (منو) و 503 (کافه بسته) هر دو وضعیت معنادارند و باید در کش بمانند،
      // وگرنه کافه تا ابد «باز» نمایش داده می‌شود
      if (response.ok || response.status === 503) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;
  const fresh = await network;
  if (fresh) return fresh;
  // آفلاین و بدون کش → خطاى واقعى شبکه تا کلاینت پیام «اتصال برقرار نیست» نشان دهد
  return Response.error();
}

/** cache-first برای فایل‌های build شده (/assets/ — نام‌شان hash دارد و ثابت است) */
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // آفلاین و بدون کش → خطای شبکه تا کلاینت پیام مناسب نشان دهد
    return Response.error();
  }
}

/** network-first برای ناوبری‌ها (صفحات SPA) با فال‌بک به کش */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const shell = await cache.match("/index.html");
      if (shell) return shell;
    }
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // درخواست‌های خارجی دست نمی‌خورند

  // منو
  if (url.pathname === MENU_URL) {
    event.respondWith(menuWithCache(request));
    return;
  }

  // منابع build شده (hash دارند و تغییر نمی‌کنند) → cache-first
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // ناوبری‌ها (صفحات SPA) → network-first با فال‌بک آفلاین
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, STATIC_CACHE));
  }
});
