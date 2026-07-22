"""تنظیمات برنامه — از فایل .env خوانده می‌شود"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # رمز ورود پنل صندوق و مدیریت
    panel_password: str = "cafe1234"
    # کلید امضای توکن JWT — در محیط واقعی حتماً عوض شود
    secret_key: str = "dev-secret-change-me"
    # مدت اعتبار توکن به ساعت
    token_expire_hours: int = 12
    # آدرس‌های مجاز فرانت برای CORS (با کاما جدا می‌شوند)
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
