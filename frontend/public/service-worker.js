// سرویس‌ورکر ساده — کش کردن درخواست منو برای نمایش آفلاین
const CACHE_NAME = "cafe-menu-v1";
const MENU_URL = "/api/menu";

// نصب: کش اولیه
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.add(MENU_URL).catch(() => {
        // اگر کش اولیه ناموفق بود، مشکلی نیست — بعداً کش می‌شود
      });
    })
  );
  self.skipWaiting();
});

// فعال‌سازی: حذف کش‌های قدیمی
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// درخواست‌ها: برای GET /api/menu از کش با fallback به شبکه
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // فقط کش کردن درخواست منو
  if (event.request.method === "GET" && url.pathname === "/api/menu") {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          // بازگرداندن کش + به‌روزرسانی در پس‌زمینه
          fetch(event.request)
            .then((response) => {
              if (response.ok) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, response.clone());
                });
              }
            })
            .catch(() => {});
          return cached;
        }
        // کش نیست — از شبکه بگیر و کش کن
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
  }
});
