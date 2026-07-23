// لایه ارتباط با API — همه درخواست‌ها از این‌جا می‌گذرند

const TOKEN_KEY = "cafe_panel_token";

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

/** هسته مشترک همه درخواست‌ها: افزودن توکن، هندل خطای شبکه و خطای سرور */
async function send<T>(path: string, options: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  // اگر توکن پنل داریم، به هدر اضافه می‌شود
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(path, { ...options, headers });
  } catch {
    throw new ApiError(0, "ارتباط با سرور برقرار نشد — اتصال را بررسی کنید");
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorResponse(res));
  }

  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => send<T>(path, {}),

  post: <T>(path: string, body: unknown): Promise<T> =>
    send<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  patch: <T>(path: string, body: unknown): Promise<T> =>
    send<T>(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  delete: <T>(path: string): Promise<T> => send<T>(path, { method: "DELETE" }),

  /** ارسال فرم چندبخشی (آپلود فایل).
   * Content-Type عمداً ست نمی‌شود تا مرورگر خودش multipart boundary بگذارد. */
  postForm: <T>(path: string, form: FormData): Promise<T> =>
    send<T>(path, { method: "POST", body: form }),
};
