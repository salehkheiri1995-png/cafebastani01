"""تنظیمات قابل تغییر در زمان اجرا — مثل حالت تعطیل کافه"""
from .config import settings


class RuntimeSettings:
    """تنظیماتی که در زمان اجرا قابل تغییر هستند"""

    def __init__(self) -> None:
        self._is_open: bool = settings.is_open

    @property
    def is_open(self) -> bool:
        return self._is_open

    @is_open.setter
    def is_open(self, value: bool) -> None:
        self._is_open = value

    def toggle_is_open(self) -> bool:
        """toggle حالت باز/بسته بودن کافه و مقدار جدید را برمی‌گرداند"""
        self._is_open = not self._is_open
        return self._is_open


runtime_settings = RuntimeSettings()
