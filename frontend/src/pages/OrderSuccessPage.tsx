import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import type { Order, OrderStatus } from "../types";
import { faNum, formatToman } from "../utils/format";
import { resolveImageUrl } from "../utils/image";

// وضعیت‌های پایانی: بعد از رسیدن به این‌ها دیگر نیازی به رفرش خودکار نیست
const TERMINAL: OrderStatus[] = ["completed", "cancelled"];

// مراحل پیگیری سفارش — ترتیب از راست به چپ (RTL)
const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "pending", label: "در انتظار" },
  { status: "preparing", label: "در حال آماده‌سازی" },
  { status: "ready", label: "آماده تحویل" },
  { status: "completed", label: "تحویل شده" },
];

/**
 * نوار پیشرفت ۴ مرحله‌ای سفارش (RTL):
 * هر مرحلهٔ رسیده تیک می‌خورد، مرحلهٔ فعلی با aria-current="step" علامت می‌خورد
 * و سفارشِ لغو‌شده به‌جای نوار، حالت لغو جداگانه نشان می‌دهد.
 */
function ProgressStepper({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <div role="status" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-berry-light px-4 py-3 text-sm font-bold text-berry">
        <span aria-hidden="true">✕</span>
        سفارش لغو شد
      </div>
    );
  }

  const currentIndex = STEPS.findIndex((s) => s.status === status);
  return (
    <ol aria-label="مرحله‌های سفارش" className="mt-4 flex items-start">
      {STEPS.map((step, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        // خط رابط سمت راست (به مرحلهٔ قبل) و سمت چپ (به مرحلهٔ بعد) —
        // اسلات‌های خالی برای اولین/آخرین مرحله تا دایره‌ها وسط‌چین بمانند
        const rightLine = i > 0 && i <= currentIndex;
        const leftLine = i < STEPS.length - 1 && i < currentIndex;
        return (
          <li key={step.status}
            aria-current={isCurrent ? "step" : undefined}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5 px-0.5">

            <div className="flex w-full items-center">
              {i > 0 ? (
                <span aria-hidden="true"
                  className={`h-0.5 flex-1 rounded-full ${rightLine ? "bg-saffron" : "bg-cream-300"}`} />
              ) : (
                <span aria-hidden="true" className="h-0.5 flex-1" />
              )}
              <span aria-hidden="true"
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-2xs font-black transition-colors ${
                  isDone
                    ? "gradient-saffron text-white shadow-warm"
                    : isCurrent
                      ? "bg-white text-saffron-dark ring-2 ring-saffron"
                      : "bg-cream-200 text-ink-faint"
                }`}>
                {isDone ? "✓" : faNum(i + 1)}
              </span>
              {i < STEPS.length - 1 ? (
                <span aria-hidden="true"
                  className={`h-0.5 flex-1 rounded-full ${leftLine ? "bg-saffron" : "bg-cream-300"}`} />
              ) : (
                <span aria-hidden="true" className="h-0.5 flex-1" />
              )}
            </div>

            <span className={`text-center text-3xs leading-tight ${
              isCurrent ? "font-black text-ink" : isDone ? "font-bold text-saffron-dark" : "font-medium text-ink-faint"
            }`}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// صفحه موفقیت سفارش — «بلیت» سفارش با QR کد مخصوص همان سفارش
export default function OrderSuccessPage() {
  const { code } = useParams<{ code: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const statusRef = useRef<OrderStatus | null>(null);

  // عنوان صفحه در تب مرورگر
  useEffect(() => {
    document.title = "پیگیری سفارش — کافه‌بستنی";
  }, []);

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

          {/* نوار پیشرفت ۴ مرحله‌ای — تغییر وضعیت با همان aria-live اعلام می‌شود */}
          <ProgressStepper status={order.status} />

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
