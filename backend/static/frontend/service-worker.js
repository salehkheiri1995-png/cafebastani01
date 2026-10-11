// سرویس‌ورکر کافه‌بستنی
// - منو: کش stale-while-revalidate (باز شدن سریع حتی آفلاین)
// - صفحات: network-first با فال‌بک به کش (کاربر آفلاین هم به اپ می‌رسد)
// - فایل‌های build شده: cache-first (نام‌شان hash دارد و تغییر نمی‌کند)
const VERSION = "v3";
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

/** network-first برای صفحات و فایل‌های build شده */
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

  // منابع build شده (hash دارند) → cache-first
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // ناوبری‌ها (صفحات SPA) → network-first با فال‌بک آفلاین
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, STATIC_CACHE));
  }
});
