import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import QtyControl from "../components/QtyControl";
import type { MenuCategory, Order } from "../types";
import { faNum, formatToman } from "../utils/format";

// ── helper: emoji for category name ──────────────────────────────────────────
function categoryEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("بستنی") || n.includes("آيس")) return "🍨";
  if (n.includes("قهوه") || n.includes("کافه") || n.includes("coffee")) return "☕";
  if (n.includes("آبمیوه") || n.includes("آب‌میوه") || n.includes("juice")) return "🍹";
  if (n.includes("کیک") || n.includes("شیرینی")) return "🎂";
  if (n.includes("چای") || n.includes("دمنوش")) return "🍵";
  if (n.includes("میلک") || n.includes("شیک") || n.includes("شیک")) return "🥤";
  if (n.includes("وافل") || n.includes("کرپ")) return "🧇";
  if (n.includes("سالاد")) return "🥗";
  if (n.includes("ساندویچ") || n.includes("برگر")) return "🥪";
  return "🍦";
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-gray-100" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-gray-100" />
          <div className="h-3 w-full rounded bg-gray-100" />
          <div className="h-3 w-1/2 rounded bg-gray-100" />
        </div>
      </div>
    </div>
  );
}

// ── QtyControl wrapper that stays typed ───────────────────────────────────────
interface QtyProps {
  value: number;
  onChange: (qty: number) => void;
  disabled?: boolean;
}
function CartQty({ value, onChange, disabled }: QtyProps) {
  return <QtyControl value={value} onChange={onChange} disabled={disabled} />;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function MenuPage() {
  const navigate = useNavigate();
  const [menu, setMenu] = useState<MenuCategory[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});
  const tabRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  // ── load menu + 30-sec auto-refresh ────────────────────────────────────────
  const loadMenu = useCallback(async (silent = false) => {
    try {
      const data = await api.get<MenuCategory[]>("/api/menu");
      setMenu(data);
      setLoadError(null);
      if (data.length > 0 && activeCategory === null) {
        setActiveCategory(data[0].id);
      }
      const availableIds = new Set(data.flatMap((c) => c.products.map((p) => p.id)));
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
  }, [activeCategory]);

  useEffect(() => {
    loadMenu();
    const timer = setInterval(() => loadMenu(true), 30_000);
    return () => clearInterval(timer);
  }, [loadMenu]);

  // ── derived state ───────────────────────────────────────────────────────────
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

  // featured: first product of each category (up to 6)
  const featuredProducts = useMemo(
    () =>
      (menu ?? [])
        .flatMap((c) => c.products.filter((p) => p.is_available).slice(0, 1))
        .slice(0, 6),
    [menu],
  );

  // ── actions ─────────────────────────────────────────────────────────────────
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
      loadMenu(true);
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToCategory = (id: number) => {
    setActiveCategory(id);
    tabRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── intersection observer: update active tab on scroll ────────────────────
  useEffect(() => {
    if (!menu) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = Number(entry.target.getAttribute("data-cat-id"));
            setActiveCategory(id);
            tabRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
          }
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    for (const cat of menu) {
      const el = sectionRefs.current[cat.id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [menu]);

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="relative mx-auto min-h-screen max-w-lg bg-cream pb-32" dir="rtl">

      {/* ═══ HEADER ══════════════════════════════════════════════════════════ */}
      <header className="relative overflow-hidden" style={{ background: "linear-gradient(to bottom, #B8791A, #33261D)" }}>
        <div className="px-4 pb-12 pt-10 text-center">
          <div className="text-5xl">🍨</div>
          <h1 className="mt-2 font-extrabold text-2xl text-white tracking-wide">کافه‌بستنی</h1>
          <p className="mt-1 text-sm text-white/70">سفارش آنلاین — تحویل حضوری</p>
        </div>
        {/* wave SVG */}
        <svg
          viewBox="0 0 390 40"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 right-0 w-full"
          style={{ height: 40 }}
        >
          <path d="M0,20 Q97.5,40 195,20 Q292.5,0 390,20 L390,40 L0,40 Z" fill="#FAF6EF" />
        </svg>
      </header>

      {/* ═══ STICKY CATEGORY TABS ════════════════════════════════════════════ */}
      {menu && menu.length > 0 && (
        <nav className="no-scrollbar sticky top-0 z-20 flex gap-2 overflow-x-auto bg-cream/90 px-4 py-3 backdrop-blur-md">
          {menu.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                ref={(el) => { tabRefs.current[cat.id] = el; }}
                type="button"
                onClick={() => scrollToCategory(cat.id)}
                className={[
                  "relative flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-saffron text-white shadow-sm"
                    : "border border-saffron/30 bg-white text-ink",
                ].join(" ")}
              >
                <span>{categoryEmoji(cat.name)}</span>
                <span>{cat.name}</span>
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-saffron-dark" />
                )}
              </button>
            );
          })}
        </nav>
      )}

      {/* ═══ MAIN BODY ═══════════════════════════════════════════════════════ */}
      <main className="space-y-6 px-4 pt-3">

        {/* ── Error state ── */}
        {loadError && (
          <div className="flex items-center gap-3 rounded-xl bg-berry-light p-4 text-sm text-berry">
            <span className="text-xl">⚠️</span>
            <span className="flex-1">{loadError}</span>
            <button
              type="button"
              onClick={() => loadMenu()}
              className="rounded-lg bg-berry px-3 py-1.5 font-bold text-white text-xs"
            >
              تلاش دوباره
            </button>
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {!menu && !loadError && (
          <>
            {/* tab skeletons */}
            <div className="flex gap-2 animate-pulse">
              {[80, 64, 96, 72].map((w, i) => (
                <div key={i} className="h-10 rounded-full bg-gray-200" style={{ width: w }} />
              ))}
            </div>
            {/* card skeletons */}
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </>
        )}

        {/* ── Empty state ── */}
        {menu && menu.length === 0 && (
          <div className="flex flex-col items-center py-20 gap-3">
            <span className="text-6xl">🍦</span>
            <p className="text-gray-400 text-base font-medium">به‌زودی برمی‌گردیم!</p>
          </div>
        )}

        {/* ── Featured row ── */}
        {menu && menu.length > 0 && featuredProducts.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-bold text-saffron-dark">⭐ پیشنهاد ما</h2>
            <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4">
              {featuredProducts.map((product) => {
                const catEmoji = categoryEmoji(
                  (menu ?? []).find((c) => c.id === product.category_id)?.name ?? "",
                );
                const qty = cart[product.id] ?? 0;
                return (
                  <div
                    key={product.id}
                    className="flex w-[90px] flex-shrink-0 snap-start flex-col items-center gap-1 rounded-2xl bg-white p-2 shadow-sm"
                  >
                    <span className="text-3xl">{catEmoji}</span>
                    <p className="line-clamp-2 text-center text-[10px] font-medium leading-tight text-ink">
                      {product.name}
                    </p>
                    <p className="text-[10px] text-saffron-dark font-bold">
                      {formatToman(product.price)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setQty(product.id, qty + 1)}
                      className="mt-auto flex h-6 w-6 items-center justify-center rounded-full bg-saffron text-white text-sm font-bold leading-none"
                    >
                      +
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Category sections ── */}
        {menu?.map((cat) => (
          <section
            key={cat.id}
            ref={(el) => { sectionRefs.current[cat.id] = el; }}
            data-cat-id={cat.id}
            className="scroll-mt-20"
          >
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-ink">
              <span>{categoryEmoji(cat.name)}</span>
              {cat.name}
            </h2>
            <div className="space-y-3">
              {cat.products.map((product) => {
                const qty = cart[product.id] ?? 0;
                const inCart = qty > 0;
                const unavailable = !product.is_available;
                return (
                  <div
                    key={product.id}
                    className={[
                      "relative rounded-2xl bg-white p-4 shadow-sm transition-all duration-200",
                      inCart ? "border-r-4 border-saffron bg-saffron/5" : "",
                      unavailable ? "opacity-50" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      {/* emoji icon */}
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-saffron-light text-2xl">
                        {categoryEmoji(cat.name)}
                      </div>
                      {/* info */}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-ink leading-snug">{product.name}</div>
                        {product.description && (
                          <div className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                            {product.description}
                          </div>
                        )}
                        <div className="mt-1 text-sm font-bold text-saffron-dark">
                          {formatToman(product.price)}
                        </div>
                      </div>
                      {/* qty control */}
                      <div className="flex-shrink-0">
                        <CartQty
                          value={qty}
                          onChange={(q) => setQty(product.id, q)}
                          disabled={unavailable}
                        />
                      </div>
                    </div>
                    {/* unavailable badge */}
                    {unavailable && (
                      <span className="absolute left-3 top-3 rounded-md bg-berry px-2 py-0.5 text-[10px] font-bold text-white">
                        ناموجود
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      {/* ═══ CART BAR (fixed bottom) ═════════════════════════════════════════ */}
      <div
        className={[
          "fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg transition-transform duration-300",
          cartCount > 0 ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-3 mb-3 rounded-2xl bg-ink px-5 py-4 shadow-xl">
          <button
            type="button"
            onClick={() => setCheckoutOpen(true)}
            className="flex w-full items-center justify-between"
          >
            {/* left: count + total */}
            <div className="flex items-center gap-2 text-white">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-saffron text-xs font-bold">
                {faNum(cartCount)}
              </span>
              <span className="text-sm">{formatToman(cartTotal)}</span>
            </div>
            {/* right: CTA */}
            <span className="rounded-xl bg-saffron px-4 py-2 text-sm font-bold text-white">
              ثبت سفارش ←
            </span>
          </button>
        </div>
      </div>

      {/* ═══ CHECKOUT BOTTOM-SHEET ═══════════════════════════════════════════ */}
      {checkoutOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50"
          onClick={() => !submitting && setCheckoutOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-10 rounded-full bg-gray-300" />
            </div>

            <div className="px-5 pb-6 pt-2">
              <h3 className="mb-4 text-lg font-bold text-ink">سفارش شما</h3>

              {/* items list */}
              <ul className="space-y-2">
                {cartLines.map((line) => (
                  <li
                    key={line.product.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex-1 font-medium text-ink">{line.product.name}</span>
                    <CartQty
                      value={line.quantity}
                      onChange={(q) => setQty(line.product.id, q)}
                      disabled={submitting}
                    />
                    <span className="w-24 text-left text-sm font-medium text-gray-600">
                      {formatToman(line.product.price * line.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              {/* dashed divider */}
              <div className="receipt-divider my-4" />

              <div className="flex items-center justify-between font-bold text-base">
                <span className="text-ink">جمع کل</span>
                <span className="text-saffron-dark">{formatToman(cartTotal)}</span>
              </div>
              <p className="mt-1 text-xs text-gray-400">پرداخت حضوری داخل کافه انجام می‌شود</p>

              {/* inputs */}
              <div className="mt-5 space-y-3">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="اسم شما (اختیاری — برای صدا زدن)"
                  maxLength={100}
                  disabled={submitting}
                  className="w-full rounded-xl border border-gray-200 bg-cream p-3 text-sm outline-none focus:border-saffron disabled:opacity-50"
                />
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="توضیحات (اختیاری — مثلاً: بدون شکر)"
                  maxLength={500}
                  rows={2}
                  disabled={submitting}
                  className="w-full rounded-xl border border-gray-200 bg-cream p-3 text-sm outline-none focus:border-saffron disabled:opacity-50"
                />
              </div>

              {/* error alert */}
              {submitError && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-berry-light p-3 text-sm text-berry">
                  <span>⚠️</span>
                  <span>{submitError}</span>
                </div>
              )}

              {/* actions */}
              <div className="mt-5 flex gap-2">
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
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-ink"
                >
                  بازگشت
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
