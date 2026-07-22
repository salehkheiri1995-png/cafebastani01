import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import QtyControl from "../components/QtyControl";
import type { MenuCategory, Order } from "../types";
import { faNum, formatToman } from "../utils/format";

// صفحه منوی مشتری — موبایل‌فرست، با به‌روزرسانی خودکار منو
export default function MenuPage() {
  const navigate = useNavigate();
  const [menu, setMenu] = useState<MenuCategory[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // سبد خرید: شناسه محصول ← تعداد
  const [cart, setCart] = useState<Record<number, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});

  const loadMenu = useCallback(async (silent = false) => {
    try {
      const data = await api.get<MenuCategory[]>("/api/menu");
      setMenu(data);
      setLoadError(null);
      // آیتم‌هایی که دیگر در منو نیستند (ناموجود/حذف‌شده) از سبد پاک می‌شوند
      const availableIds = new Set(
        data.flatMap((c) => c.products.map((p) => p.id)),
      );
      setCart((prev) => {
        const next: Record<number, number> = {};
        for (const [id, qty] of Object.entries(prev)) {
          if (availableIds.has(Number(id))) next[Number(id)] = qty;
        }
        return next;
      });
    } catch (e) {
      if (!silent)
        setLoadError(e instanceof ApiError ? e.message : "خطا در دریافت منو");
    }
  }, []);

  // دریافت منو + به‌روزرسانی هر ۳۰ ثانیه تا تغییرات مدیر فوراً دیده شود
  useEffect(() => {
    loadMenu();
    const timer = setInterval(() => loadMenu(true), 30_000);
    return () => clearInterval(timer);
  }, [loadMenu]);

  const allProducts = useMemo(
    () => (menu ?? []).flatMap((c) => c.products),
    [menu],
  );
  const cartLines = useMemo(
    () =>
      allProducts
        .filter((p) => (cart[p.id] ?? 0) > 0)
        .map((p) => ({ product: p, quantity: cart[p.id] })),
    [allProducts, cart],
  );
  const cartCount = cartLines.reduce((sum, l) => sum + l.quantity, 0);
  const cartTotal = cartLines.reduce(
    (sum, l) => sum + l.product.price * l.quantity,
    0,
  );

  const setQty = (productId: number, qty: number) => {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  };

  const submitOrder = async () => {
    if (cartLines.length === 0 || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const order = await api.post<Order>("/api/orders", {
        items: cartLines.map((l) => ({
          product_id: l.product.id,
          quantity: l.quantity,
        })),
        customer_name: customerName.trim() || null,
        note: note.trim() || null,
      });
      navigate(`/order/${order.code}`);
    } catch (e) {
      setSubmitError(
        e instanceof ApiError ? e.message : "ثبت سفارش ناموفق بود — دوباره تلاش کنید",
      );
      loadMenu(true); // شاید محصولی همین الان ناموجود شده باشد
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToCategory = (id: number) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg pb-28">
      {/* سربرگ */}
      <header className="px-4 pb-4 pt-8 text-center">
        <div className="text-3xl">🍨</div>
        <h1 className="mt-1 text-2xl font-extrabold">کافه‌بستنی</h1>
        <p className="mt-1 text-sm text-gray-500">
          بستنی سنتی، آبمیوه طبیعی، قهوه — سفارش بده، QR بگیر، داخل کافه تحویل بگیر
        </p>
      </header>

      {/* تب‌های دسته‌بندی — چسبان بالای صفحه */}
      {menu && menu.length > 0 && (
        <nav className="no-scrollbar sticky top-0 z-10 flex gap-2 overflow-x-auto bg-cream/95 px-4 py-3 backdrop-blur">
          {menu.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => scrollToCategory(cat.id)}
              className="whitespace-nowrap rounded-full border border-saffron/40 bg-white px-4 py-1.5 text-sm font-medium hover:bg-saffron-light"
            >
              {cat.name}
            </button>
          ))}
        </nav>
      )}

      {/* بدنه منو */}
      <main className="space-y-6 px-4 pt-2">
        {loadError && (
          <div className="rounded-xl bg-berry-light p-4 text-sm text-berry">
            {loadError}
            <button
              type="button"
              onClick={() => loadMenu()}
              className="mr-2 font-bold underline"
            >
              تلاش دوباره
            </button>
          </div>
        )}

        {!menu && !loadError && (
          <p className="py-16 text-center text-gray-400">در حال دریافت منو…</p>
        )}

        {menu && menu.length === 0 && (
          <p className="py-16 text-center text-gray-400">
            فعلاً چیزی در منو نیست — به‌زودی برمی‌گردیم!
          </p>
        )}

        {menu?.map((cat) => (
          <section
            key={cat.id}
            ref={(el) => {
              sectionRefs.current[cat.id] = el;
            }}
            className="scroll-mt-16"
          >
            <h2 className="mb-3 text-lg font-bold">{cat.name}</h2>
            <div className="space-y-3">
              {cat.products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <div className="font-bold">{product.name}</div>
                    {product.description && (
                      <div className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                        {product.description}
                      </div>
                    )}
                    <div className="mt-1 text-sm font-bold text-saffron-dark">
                      {formatToman(product.price)}
                    </div>
                  </div>
                  <QtyControl
                    value={cart[product.id] ?? 0}
                    onChange={(qty) => setQty(product.id, qty)}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* نوار سبد — چسبان پایین صفحه */}
      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-lg p-3">
          <button
            type="button"
            onClick={() => setCheckoutOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-ink px-5 py-4 text-white shadow-lg"
          >
            <span className="text-sm">
              {faNum(cartCount)} قلم — {formatToman(cartTotal)}
            </span>
            <span className="rounded-full bg-saffron px-4 py-1.5 text-sm font-bold">
              ادامه و ثبت سفارش
            </span>
          </button>
        </div>
      )}

      {/* مرور و ثبت نهایی سفارش */}
      {checkoutOpen && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4"
          onClick={() => !submitting && setCheckoutOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-bold">مرور سفارش</h3>

            <ul className="space-y-2">
              {cartLines.map((line) => (
                <li
                  key={line.product.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span>
                    {line.product.name}
                    <span className="text-gray-500"> × {faNum(line.quantity)}</span>
                  </span>
                  <span className="font-medium">
                    {formatToman(line.product.price * line.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="receipt-divider my-3" />
            <div className="flex items-center justify-between font-bold">
              <span>جمع کل</span>
              <span className="text-saffron-dark">{formatToman(cartTotal)}</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              پرداخت حضوری داخل کافه انجام می‌شود
            </p>

            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="اسم شما (اختیاری — برای صدا زدن)"
                maxLength={100}
                className="w-full rounded-xl border border-gray-200 bg-cream p-3 text-sm outline-none focus:border-saffron"
              />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="توضیحات (اختیاری — مثلاً: بدون شکر)"
                maxLength={500}
                rows={2}
                className="w-full rounded-xl border border-gray-200 bg-cream p-3 text-sm outline-none focus:border-saffron"
              />
            </div>

            {submitError && (
              <p className="mt-3 rounded-xl bg-berry-light p-3 text-sm text-berry">
                {submitError}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={submitOrder}
                className="flex-1 rounded-xl bg-saffron px-4 py-3 font-bold text-white transition-opacity hover:bg-saffron-dark disabled:opacity-50"
              >
                {submitting ? "در حال ثبت…" : "ثبت نهایی سفارش"}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setCheckoutOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm"
              >
                بازگشت
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
