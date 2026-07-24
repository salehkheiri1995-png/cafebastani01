import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api/client";

interface UseApiOptions {
  /** آیا درخواست بلافاصله اجرا شود (پیش‌فرض: true) */
  immediate?: boolean;
  /** تعداد تلاش‌های مجدد (پیش‌فرض: 3) */
  retries?: number;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** اجرای مجدد درخواست */
  refetch: () => Promise<void>;
  /** پاک کردن خطا */
  clearError: () => void;
}

// hook سفارشی برای درخواست‌های API با loading state و retry خودکار
export function useApi<T>(
  path: string,
  options: UseApiOptions = {},
): UseApiResult<T> {
  const { immediate = true, retries = 3 } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetcher = useCallback(
    async (retryCount = 0) => {
      // لغو درخواست قبلی
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const result = await api.get<T>(path);
        if (mountedRef.current && !controller.signal.aborted) {
          setData(result);
        }
      } catch (e) {
        if (controller.signal.aborted) return;

        const msg =
          e instanceof ApiError
            ? e.message
            : "خطا در اتصال به سرور";

        // تلاش مجدد با تاخیر exponential
        if (retryCount < retries) {
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise((r) => setTimeout(r, delay));
          if (mountedRef.current && !controller.signal.aborted) {
            return fetcher(retryCount + 1);
          }
        }

        if (mountedRef.current && !controller.signal.aborted) {
          setError(msg);
        }
      } finally {
        if (mountedRef.current && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [path, retries],
  );

  useEffect(() => {
    mountedRef.current = true;
    if (immediate) {
      fetcher();
    }
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [immediate, fetcher]);

  const refetch = useCallback(async () => {
    await fetcher();
  }, [fetcher]);

  const clearError = useCallback(() => setError(null), []);

  return { data, loading, error, refetch, clearError };
}
