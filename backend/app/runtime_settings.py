"""تنظیمات قابل تغییر در زمان اجرا — مثل حالت تعطیل کافه"""
import json
import threading
from pathlib import Path

from .config import settings

STATE_FILE = Path(__file__).resolve().parent.parent / "cafe_state.json"
_lock = threading.Lock()


class RuntimeSettings:
    """تنظیماتی که در زمان اجرا قابل تغییر هستند"""

    def __init__(self) -> None:
        self._is_open: bool = self._load()

    def _load(self) -> bool:
        try:
            if STATE_FILE.exists():
                return json.loads(STATE_FILE.read_text()).get("is_open", settings.is_open)
        except Exception:
            pass
        return settings.is_open

    def _save(self) -> None:
        try:
            STATE_FILE.write_text(json.dumps({"is_open": self._is_open}))
        except Exception:
            pass

    @property
    def is_open(self) -> bool:
        return self._is_open

    @is_open.setter
    def is_open(self, value: bool) -> None:
        with _lock:
            self._is_open = value
            self._save()

    def toggle_is_open(self) -> bool:
        """toggle حالت باز/بسته بودن کافه و مقدار جدید را برمی‌گرداند"""
        with _lock:
            self._is_open = not self._is_open
            self._save()
        return self._is_open


runtime_settings = RuntimeSettings()
