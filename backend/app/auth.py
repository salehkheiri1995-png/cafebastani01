"""لاگین ساده با رمز عبور و صدور توکن JWT برای پنل‌ها"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from .config import settings
from .schemas import LoginIn, TokenOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

# auto_error=False تا خودمان پیام فارسی مناسب برگردانیم
bearer = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn):
    """مقایسه رمز واردشده با رمز تعریف‌شده در .env و صدور توکن"""
    if body.password != settings.panel_password:
        raise HTTPException(status_code=401, detail="رمز عبور اشتباه است")
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.token_expire_hours)
    token = jwt.encode(
        {"sub": "panel", "exp": expire}, settings.secret_key, algorithm=ALGORITHM
    )
    return TokenOut(token=token)


def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> None:
    """Dependency مسیرهای محافظت‌شده — توکن Bearer را بررسی می‌کند"""
    if credentials is None:
        raise HTTPException(status_code=401, detail="ابتدا وارد شوید")
    try:
        jwt.decode(credentials.credentials, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="توکن نامعتبر یا منقضی است")
