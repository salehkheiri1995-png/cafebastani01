// لایه ارتباط با API — همه درخواست‌ها از این‌جا می‌گذرند

const TOKEN_KEY = "cafe_panel_token";
const DEFAULT_TIMEOUT = 20_000; // ۲۰ ثانیه: جلوگیری از آویزان ماندن درخواست‌ها

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** استخراج پیام خطای فارسی از بدنه پاسخ FastAPI ({detail: "..."}) */
async function parseErrorResponse(res: Response): Promise<string> {
  let message = "خطا در ارتباط با سرور";
  try {
    const data: unknown = await res.json();
    if (typeof data === "object" && data !== null && "detail" in data) {
      const detail: unknown = (data as { detail: unknown }).detail;
      if (typeof detail === "string") message = detail;
      else if (Array.isArray(detail)) message = "ورودی نامعتبر است";
    }
  } catch {
    /* بدنه JSON نبود — همان پیام پیش‌فرض */
  }
  return message;
}

export interface RequestOptions {
  /** لغو درخواست (مثلاً هنگام خروج از کامپوننت) */
  signal?: AbortSignal;
  /** مهلت زمانی برای درخواست — پیش‌فرض ۲۰ ثانیه */
  timeoutMs?: number;
}

/** هسته مشترک همه درخواست‌ها: افزودن توکن، هندل خطای شبکه و خطای سرور */
async function send<T>(path: string, options: RequestInit, req: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  // اگر توکن پنل داریم، به هدر اضافه می‌شود
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // ترکیب لغو بیرونی + مهلت زمانی داخلی
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), req.timeoutMs ?? DEFAULT_TIMEOUT);
  const onAbort = () => controller.abort();
  if (req.signal) {
    if (req.signal.aborted) controller.abort();
    else req.signal.addEventListener("abort", onAbort, { once: true });
  }

  let res: Response;
  try {
    res = await fetch(path, { ...options, headers, signal: controller.signal });
  } catch (err) {
    if (req.signal?.aborted) throw new ApiError(0, "درخواست لغو شد");
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new ApiError(0, "پاسخی از سرور نرسید — زمان انتظار تمام شد");
    }
    throw new ApiError(0, "ارتباط با سرور برقرار نشد — اتصال را بررسی کنید");
  } finally {
    clearTimeout(timeout);
    req.signal?.removeEventListener("abort", onAbort);
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorResponse(res));
  }

  // پاسخ ۲۰۴ یا بدنه خالی نباید خطا بدهد
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(res.status, "پاسخ نامعتبر از سرور");
  }
}

export const api = {
  get: <T>(path: string, req?: RequestOptions): Promise<T> => send<T>(path, {}, req),

  post: <T>(path: string, body: unknown, req?: RequestOptions): Promise<T> =>
    send<T>(
      path,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      req,
    ),

  patch: <T>(path: string, body: unknown, req?: RequestOptions): Promise<T> =>
    send<T>(
      path,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      req,
    ),

  delete: <T>(path: string, req?: RequestOptions): Promise<T> => send<T>(path, { method: "DELETE" }, req),

  /** ارسال فرم چندبخشی (آپلود فایل).
   * Content-Type عمداً ست نمی‌شود تا مرورگر خودش multipart boundary بگذارد. */
  postForm: <T>(path: string, form: FormData, req?: RequestOptions): Promise<T> =>
    send<T>(path, { method: "POST", body: form }, req),
};

/** پیام مناسب برای خطای ۴۰۱ (نشست منقضی) — در پنل‌ها استفاده می‌شود */
export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}
