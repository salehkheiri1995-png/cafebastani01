"""لاگین ساده با رمز عبور و صدور توکن JWT برای پنل‌ها"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from .config import settings
from .rate_limit import SlidingWindowLimiter, client_ip
from .schemas import LoginIn, TokenOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

# auto_error=False تا خودمان پیام فارسی مناسب برگردانیم
bearer = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"

# ── Rate Limiting ساده برای login ─────────────────────────────────────────────
login_limiter = SlidingWindowLimiter(
    max_requests=5,  # حداکثر تعداد تلاش در بازه
    window_seconds=60,  # ثانیه
    detail="تعداد تلاش‌های ورود بیش از حد مجاز است — لطفاً یک دقیقه صبر کنید",
)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request):
    """مقایسه رمز واردشده با رمزهای تعریف‌شده در .env و صدور توکن با نقش مناسب"""
    # بررسی نرخ درخواست بر اساس IP کلاینت
    login_limiter.check(client_ip(request))

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
