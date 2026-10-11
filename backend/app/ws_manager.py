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
        dead: list[WebSocket] = []
        for connection in self._connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead.append(connection)
        for d in dead:
            self.disconnect(d)

    def broadcast_threadsafe(self, message: dict) -> None:
        """ارسال پیام از یک thread دیگر (مثلاً threadpool FastAPI) به event loop اصلی.
        اگر کلاینتی متصل نباشد کاری انجام نمی‌شود."""
        if not self._connections or self._loop is None or self._loop.is_closed():
            return
        asyncio.run_coroutine_threadsafe(self.broadcast(message), self._loop)


# نمونه سراسری — همه اتصالات WebSocket از این استفاده می‌کنند
ws_manager = ConnectionManager()
