import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import type { Order, OrderStatus } from "../types";
import { faNum, formatToman } from "../utils/format";
import { resolveImageUrl } from "../utils/image";

// وضعیت‌های پایانی: بعد از رسیدن به این‌ها دیگر نیازی به رفرش خودکار نیست
const TERMINAL: OrderStatus[] = ["completed", "cancelled"];

// صفحه موفقیت سفارش — «بلیت» سفارش با QR کد مخصوص همان سفارش
export default function OrderSuccessPage() {
  const { code } = useParams<{ code: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const statusRef = useRef<OrderStatus | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!code) return;
      try {
        const data = await api.get<Order>(`/api/orders/${encodeURIComponent(code)}`);
        statusRef.current = data.status;
        setOrder((prev) => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
        setError(null);
      } catch (e) {
        // اگر سفارش قبلاً نمایش داده شده، خطای مقطعی آن را از بین نمی‌برد
        if (!silent) setError(e instanceof ApiError ? e.message : "خطا در دریافت سفارش");
      } finally {
        setLoading(false);
      }
    },
    [code],
  );

  // وضعیت سفارش هر ۱۵ ثانیه تازه می‌شود تا مشتری «آماده شد» را ببیند
  // بعد از رسیدن به وضعیت پایانی، رفرش خودکار متوقف می‌شود
  useEffect(() => {
    let timer: number | undefined;
    const stop = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };
    const isTerminal = () => (statusRef.current ? TERMINAL.includes(statusRef.current) : false);

    const tick = () => {
      if (isTerminal()) return stop();
      if (document.hidden) return; // در تب مخفی نیازی به رفرش نیست
      load(true);
    };

    load();
    timer = window.setInterval(tick, 15_000);
    const onVisibility = () => {
      if (!document.hidden && !isTerminal()) load(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  if (error && !order) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center" dir="rtl">
        <div className="rounded-2xl bg-berry-light p-5 text-sm text-berry shadow-soft" role="alert">
          {error}
        </div>
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              load();
            }}
            className="gradient-saffron rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-warm transition-all active:scale-95"
          >
            تلاش دوباره
          </button>
          <Link
            to="/"
            className="rounded-xl border border-saffron/40 px-5 py-2.5 text-sm font-bold text-saffron-dark transition-colors hover:bg-saffron-100"
          >
            بازگشت به منو
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-sm animate-pulse px-4 py-8" dir="rtl" aria-busy="true">
        <div className="overflow-hidden rounded-2xl bg-white shadow-card">
          <div className="h-20 w-full bg-gradient-to-b from-saffron to-saffron-dark" />
          <div className="space-y-3 p-5">
            <div className="mx-auto h-5 w-1/2 rounded bg-cream-200" />
            <div className="mx-auto h-40 w-40 rounded-xl bg-cream-200" />
            <div className="h-4 w-24 rounded bg-cream-200" />
            <div className="h-px w-full bg-cream-200" />
            <div className="h-4 w-full rounded bg-cream-100" />
            <div className="h-4 w-3/4 rounded bg-cream-100" />
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-ink-muted">{loading ? "در حال دریافت سفارش…" : ""}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-8" dir="rtl">
      {/* بلیت سفارش */}
      <div className="overflow-hidden rounded-3xl bg-white shadow-elevated">
        <div className="gradient-saffron px-5 py-5 text-center text-white">
          <div className="text-2xl" aria-hidden="true">🍨</div>
          <div className="font-display text-xl leading-tight">کافه‌بستنی تی‌تی</div>
        </div>

        <div className="p-5 text-center">
          <h1 className="font-display text-2xl text-pistachio">سفارشت ثبت شد ✓</h1>
          <p className="mt-1 text-xs text-ink-muted">
            این QR را داخل کافه به صندوق نشان بده
          </p>

          {/* شماره صف */}
          {order.queue_number && (
            <div className="gradient-saffron mt-4 rounded-2xl px-5 py-3">
              <p className="text-2xs font-medium text-white/75">شماره صف شما</p>
              <p className="text-4xl font-black text-white" dir="ltr">
                {faNum(order.queue_number)}
              </p>
            </div>
          )}

          {order.qr_image && (
            <img
              src={resolveImageUrl(order.qr_image) ?? order.qr_image}
              alt={`QR کد سفارش ${order.code}`}
              width={208}
              height={208}
              className="mx-auto mt-4 w-52 rounded-xl border border-cream-200"
            />
          )}

          {/* کد متنی — برای وقتی اسکن ممکن نبود */}
          <div className="mt-3 font-mono text-2xl font-extrabold tracking-[0.3em] num" dir="ltr">
            {order.code}
          </div>

          <div className="mt-3" aria-live="polite">
            <StatusBadge status={order.status} />
          </div>

          {/* اقلام سفارش */}
          <div className="receipt-divider my-4" />
          <ul className="space-y-2 text-right">
            {order.items.map((item) => (
              <li key={`${item.product_id}-${item.product_name}`} className="flex items-baseline justify-between gap-2 text-sm">
                <span>
                  {item.product_name}
                  <span className="text-ink-muted"> × {faNum(item.quantity)}</span>
                </span>
                <span className="whitespace-nowrap num">{formatToman(item.unit_price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="receipt-divider my-4" />

          <div className="flex items-center justify-between font-bold">
            <span>جمع کل</span>
            <span className="text-saffron-dark num">{formatToman(order.total_amount)}</span>
          </div>
          <p className="mt-1 text-right text-xs text-ink-muted">پرداخت حضوری موقع تحویل</p>
        </div>
      </div>

      <div className="mt-5 text-center">
        <Link
          to="/"
          className="inline-block rounded-xl border border-saffron px-5 py-2.5 text-sm font-bold text-saffron-dark transition-colors hover:bg-saffron-100"
        >
          سفارش جدید
        </Link>
        <p className="mt-3 text-xs text-ink-faint">
          آدرس این صفحه را نگه دار — هر وقت بازش کنی سفارشت را می‌بینی
        </p>
      </div>
    </div>
  );
}
