"""محدودسازی نرخ درخواست‌ها — الگوی ساده درون‌process برای login و ثبت سفارش"""
import threading
import time

from fastapi import HTTPException, Request


class SlidingWindowLimiter:
    """شمارش درخواست‌های هر کلید (معمولاً IP) در یک پنجره لغزنده — thread-safe.

    اگر تعداد درخواست‌های یک کلید از سقف بگذرد، با 429 و پیام فارسی رد می‌شود."""

    def __init__(self, max_requests: int, window_seconds: float, detail: str) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.detail = detail
        # { کلید: [زمان درخواست‌ها] }
        self._events: dict[str, list[float]] = {}
        self._lock = threading.Lock()
        self._last_cleanup = time.monotonic()

    def check(self, key: str) -> None:
        """ثبت درخواست جدید؛ اگر از سقف گذشته باشد HTTPException با کد 429 برمی‌گرداند"""
        now = time.monotonic()
        with self._lock:
            # هر پنجره، کلیدهای بی‌استفاده را پاک کن تا حافظه رشد نکند
            if now - self._last_cleanup >= self.window_seconds:
                self._last_cleanup = now
                for stale in [
                    k
                    for k, events in self._events.items()
                    if not events or now - events[-1] >= self.window_seconds
                ]:
                    del self._events[stale]

            events = self._events.setdefault(key, [])
            events[:] = [t for t in events if now - t < self.window_seconds]
            if len(events) >= self.max_requests:
                raise HTTPException(status_code=429, detail=self.detail)
            events.append(now)


def client_ip(request: Request) -> str:
    """IP کلاینت برای کلید زدن rate limiting"""
    return request.client.host if request.client else "unknown"
