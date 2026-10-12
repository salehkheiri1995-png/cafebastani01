"""مدیریت اتصالات WebSocket برای اعلان سفارش جدید"""
import asyncio

from fastapi import WebSocket


class ConnectionManager:
    """مدیریت اتصالات WebSocket فعال — broadcast پیام به همه کلاینت‌های متصل"""

    def __init__(self) -> None:
        self._connections: list[WebSocket] = []
        self._loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, websocket: WebSocket) -> None:
        """اتصال جدید را بپذیر و در لیست نگه‌دار"""
        # ذخیره event loop اصلی تا endpointهای همزمان (threadpool) بتوانند broadcast کنند
        self._loop = asyncio.get_running_loop()
        await websocket.accept()
        self._connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        """اتصال قطع شده را از لیست حذف کن"""
        if websocket in self._connections:
            self._connections.remove(websocket)

    async def broadcast(self, message: dict) -> None:
        """ارسال پیام به همه کلاینت‌های متصل — اتصال‌های خراب حذف می‌شوند"""
        if not self._connections:
            return
        # کپی از لیست چون disconnect در حین بررسی ممکن است آن را تغییر دهد
        connections = list(self._connections)
        results = await asyncio.gather(
            *(connection.send_json(message) for connection in connections),
            return_exceptions=True,
        )
        for connection, result in zip(connections, results):
            if isinstance(result, BaseException):
                self.disconnect(connection)

    async def close_all(self, code: int = 1001) -> None:
        """بستن همه اتصال‌های باز هنگام خاموش شدن سرور"""
        if not self._connections:
            return
        connections = list(self._connections)
        self._connections.clear()
        await asyncio.gather(
            *(connection.close(code=code) for connection in connections),
            return_exceptions=True,
        )

    def broadcast_threadsafe(self, message: dict) -> None:
        """ارسال پیام از یک thread دیگر (مثلاً threadpool FastAPI) به event loop اصلی.
        اگر کلاینتی متصل نباشد کاری انجام نمی‌شود."""
        if not self._connections or self._loop is None or self._loop.is_closed():
            return
        asyncio.run_coroutine_threadsafe(self.broadcast(message), self._loop)


# نمونه سراسری — همه اتصالات WebSocket از این استفاده می‌کنند
ws_manager = ConnectionManager()
