"""لاگین ساده با رمز عبور و صدور توکن JWT برای پنل‌ها"""
from datetime import datetime, timedelta, timezone
from collections import defaultdict
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from .config import settings
from .schemas import LoginIn, TokenOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

# auto_error=False تا خودمان پیام فارسی مناسب برگردانیم
bearer = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"

# ── Rate Limiting ساده برای login ─────────────────────────────────────────────
# ساختار: { ip: [timestamp1, timestamp2, ...] }
_login_attempts: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 60  # ثانیه
RATE_LIMIT_MAX = 5      # حداکثر تعداد تلاش در بازه


def _check_rate_limit(ip: str) -> None:
    """بررسی نرخ درخواست — اگر بیش از حد مجاز باشد خطا برمی‌گرداند"""
    now = time.time()
    # حذف تلاش‌های قدیمی‌تر از بازه زمانی
    _login_attempts[ip] = [t for t in _login_attempts[ip] if now - t < RATE_LIMIT_WINDOW]
    if len(_login_attempts[ip]) >= RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=429,
            detail="تعداد تلاش‌های ورود بیش از حد مجاز است — لطفاً یک دقیقه صبر کنید",
        )
    _login_attempts[ip].append(now)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request):
    """مقایسه رمز واردشده با رمزهای تعریف‌شده در .env و صدور توکن با نقش مناسب"""
    # دریافت IP کلاینت برای rate limiting
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    # بررسی رمز صندوق
    if body.password == settings.cashier_password:
        role = "cashier"
    elif body.password == settings.admin_password:
        role = "admin"
    else:
        raise HTTPException(status_code=401, detail="رمز عبور اشتباه است")

    expire = datetime.now(timezone.utc) + timedelta(hours=settings.token_expire_hours)
    token = jwt.encode(
        {"sub": "panel", "role": role, "exp": expire},
        settings.secret_key,
        algorithm=ALGORITHM,
    )
    return TokenOut(token=token)


def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict:
    """Dependency مسیرهای محافظت‌شده — توکن Bearer را بررسی می‌کند و اطلاعات نقش را برمی‌گرداند"""
    if credentials is None:
        raise HTTPException(status_code=401, detail="ابتدا وارد شوید")
    try:
        payload = jwt.decode(
            credentials.credentials, settings.secret_key, algorithms=[ALGORITHM]
        )
        return {"role": payload.get("role", "cashier")}
    except JWTError:
        raise HTTPException(status_code=401, detail="توکن نامعتبر یا منقضی است")


def require_role(required_role: str):
    """Dependency برای بررسی نقش خاص — مثلاً require_role("admin")"""
    def _check(auth_data: dict = Depends(require_auth)):
        if auth_data.get("role") != required_role:
            raise HTTPException(status_code=403, detail="دسترسی مجاز نیست")
        return auth_data
    return _check
