import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import type { Order } from "../types";
import { faNum, formatToman } from "../utils/format";

// صفحه موفقیت سفارش — «بلیت» سفارش با QR کد مخصوص همان سفارش
export default function OrderSuccessPage() {
  const { code } = useParams<{ code: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!code) return;
    try {
      const data = await api.get<Order>(`/api/orders/${encodeURIComponent(code)}`);
      setOrder(data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "خطا در دریافت سفارش");
    }
  }, [code]);

  // وضعیت سفارش هر ۱۵ ثانیه تازه می‌شود تا مشتری «آماده شد» را ببیند
  useEffect(() => {
    load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, [load]);

  if (error) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center">
        <p className="rounded-xl bg-berry-light p-4 text-sm text-berry">{error}</p>
        <Link to="/" className="mt-4 inline-block font-bold text-saffron-dark underline">
          بازگشت به منو
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <p className="py-16 text-center text-gray-400">در حال دریافت سفارش…</p>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-8">
      {/* بلیت سفارش */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="bg-saffron px-5 py-4 text-center text-white">
          <div className="text-2xl">🍨</div>
          <div className="font-extrabold">کافه‌بستنی</div>
        </div>

        <div className="p-5 text-center">
          <h1 className="text-lg font-extrabold text-pistachio">
            سفارشت ثبت شد ✓
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            این QR را داخل کافه به صندوق نشان بده
          </p>

          {/* شماره صف */}
          {order.queue_number && (
            <div className="mt-4 rounded-2xl px-5 py-3"
              style={{ background: "linear-gradient(135deg, #E9A13B, #B8791A)" }}>
              <p className="text-xs font-medium text-white/70">شماره صف شما</p>
              <p className="text-4xl font-black text-white" dir="ltr">
                {faNum(order.queue_number)}
              </p>
            </div>
          )}

          {order.qr_image && (
            <img
              src={order.qr_image}
              alt={`QR کد سفارش ${order.code}`}
              className="mx-auto mt-4 w-52 rounded-xl border border-gray-100"
            />
          )}

          {/* کد متنی — برای وقتی اسکن ممکن نبود */}
          <div
            className="mt-3 font-mono text-2xl font-extrabold tracking-[0.3em]"
            dir="ltr"
          >
            {order.code}
          </div>

          <div className="mt-3">
            <StatusBadge status={order.status} />
          </div>

          {/* اقلام سفارش */}
          <div className="receipt-divider my-4" />
          <ul className="space-y-2 text-right">
            {order.items.map((item, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between gap-2 text-sm"
              >
                <span>
                  {item.product_name}
                  <span className="text-gray-500"> × {faNum(item.quantity)}</span>
                </span>
                <span className="whitespace-nowrap">
                  {formatToman(item.unit_price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="receipt-divider my-4" />

          <div className="flex items-center justify-between font-bold">
            <span>جمع کل</span>
            <span className="text-saffron-dark">
              {formatToman(order.total_amount)}
            </span>
          </div>
          <p className="mt-1 text-right text-xs text-gray-500">
            پرداخت حضوری موقع تحویل
          </p>
        </div>
      </div>

      <div className="mt-5 text-center">
        <Link
          to="/"
          className="inline-block rounded-xl border border-saffron px-5 py-2.5 text-sm font-bold text-saffron-dark hover:bg-saffron-light"
        >
          سفارش جدید
        </Link>
        <p className="mt-3 text-xs text-gray-400">
          آدرس این صفحه را نگه دار — هر وقت بازش کنی سفارشت را می‌بینی
        </p>
      </div>
    </div>
  );
}
