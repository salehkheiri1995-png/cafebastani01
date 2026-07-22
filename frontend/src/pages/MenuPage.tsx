import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import QtyControl from "../components/QtyControl";
import type { MenuCategory, Order, Product } from "../types";
import { faNum, formatToman } from "../utils/format";

// ── emoji fallback by category name ──────────────────────────────────────────
function categoryEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("بستنی") || n.includes("آیس") || n.includes("ice")) return "🍨";
  if (n.includes("قهوه") || n.includes("کافه") || n.includes("coffee")) return "☕";
  if (n.includes("آبمیوه") || n.includes("آب‌میوه") || n.includes("juice")) return "🧃";
  if (n.includes("کیک") || n.includes("شیرینی")) return "🎂";
  if (n.includes("چای") || n.includes("دمنوش")) return "🍵";
  if (n.includes("میلک") || n.includes("شیک")) return "🥤";
  if (n.includes("وافل") || n.includes("کرپ")) return "🧇";
  if (n.includes("اسموتی") || n.includes("فراپه")) return "🥛";
  return "🍦";
}

// ── skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl bg-white p-0 shadow-sm overflow-hidden">
      <div className="h-36 bg-gray-100 w-full" />
      <div className="p-3 space-y-2">
        <div className="h-4 w-2/3 rounded bg-gray-100" />
        <div className="h-3 w-full rounded bg-gray-100" />
        <div className="h-3 w-1/2 rounded bg-gray-100" />
      </div>
    </div>
  );
}

// ── typed qty wrapper ─────────────────────────────────────────────────────────
interface QtyProps { value: number; onChange: (q: number) => void; disabled?: boolean; }
function CartQty({ value, onChange, disabled }: QtyProps) {
  return <QtyControl value={value} onChange={onChange} disabled={disabled} />;
}

// ── product image with fallback emoji ─────────────────────────────────────────
function ProductImage({ product, catName, size = "full" }: { product: Product; catName: string; size?: "full" | "thumb" }) {
  const [err, setErr] = useState(false);
  if (product.image_url && !err) {
    return (
      <img
        src={product.image_url}
        alt={product.name}
        onError={() => setErr(true)}
        className={size === "full" ? "h-36 w-full object-cover" : "h-full w-full object-cover"}
      />
    );
  }
  return (
    <div className={[
      "flex items-center justify-center bg-gradient-to-br from-saffron-light to-cream",
      size === "full" ? "h-36 w-full" : "h-full w-full",
    ].join(" ")}>
      <span className={size === "full" ? "text-4xl" : "text-3xl"}>{categoryEmoji(catName)}</span>
    </div>
  );
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

  // ── load menu + 30-sec auto-refresh ──────────────────────────────────────
  const loadMenu = useCallback(async (silent = false) => {
    try {
      const data = await api.get<MenuCategory[]>("/api/menu");
      setMenu(data);
      setLoadError(null);
      setActiveCategory((prev) => prev ?? (data[0]?.id ?? null));
      const availableIds = new Set(data.flatMap((c) => c.products.map((p) => p.id)));
      setCart((prev) => {
        const next: Record<number, number> = {};
        for (const [id, qty] of Object.entries(prev)) {
          if (availableIds.has(Number(id))) next[Number(id)] = qty;
        }
        return next;
      });
    } catch (e) {
      if (!silent) setLoadError(e instanceof ApiError ? e.message : "خطا در دریافت منو");
    }
  }, []);

  useEffect(() => {
    loadMenu();
    const timer = setInterval(() => loadMenu(true), 30_000);
    return () => clearInterval(timer);
  }, [loadMenu]);

  // ── intersection observer → active tab ───────────────────────────────────
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

  // ── derived ───────────────────────────────────────────────────────────────
  const allProducts = useMemo(() => (menu ?? []).flatMap((c) => c.products), [menu]);
  const cartLines = useMemo(
    () => allProducts.filter((p) => (cart[p.id] ?? 0) > 0).map((p) => ({ product: p, quantity: cart[p.id] })),
    [allProducts, cart],
  );
  const cartCount = cartLines.reduce((s, l) => s + l.quantity, 0);
  const cartTotal = cartLines.reduce((s, l) => s + l.product.price * l.quantity, 0);

  const featuredProducts = useMemo(
    () => (menu ?? []).flatMap((c) => c.products.filter((p) => p.is_available).slice(0, 1)).slice(0, 6),
    [menu],
  );

  // ── actions ───────────────────────────────────────────────────────────────
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
        items: cartLines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
        customer_name: customerName.trim() || null,
        note: note.trim() || null,
      });
      navigate(`/order/${order.code}`);
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : "ثبت سفارش ناموفق بود — دوباره تلاش کنید");
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

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative mx-auto min-h-screen max-w-lg pb-32" dir="rtl"
      style={{ background: "linear-gradient(160deg, #FFF8F0 0%, #FAF6EF 60%, #F0EBE3 100%)" }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #E9A13B 0%, #B8791A 45%, #33261D 100%)" }}>

        {/* decorative circles */}
        <div className="absolute -top-8 -left-8 h-32 w-32 rounded-full bg-white/10" />
        <div className="absolute -top-4 left-16 h-20 w-20 rounded-full bg-white/10" />
        <div className="absolute top-4 -right-6 h-24 w-24 rounded-full bg-white/5" />

        <div className="relative px-5 pb-14 pt-10 text-center">
          {/* logo row */}
          <div className="mb-2 flex items-center justify-center gap-2">
            <span className="text-4xl">🍨</span>
            <span className="text-3xl">🍦</span>
            <span className="text-4xl">🍧</span>
          </div>
          {/* cafe name */}
          <h1 className="font-extrabold text-white drop-shadow" style={{ fontSize: "2rem", letterSpacing: "0.05em", fontFamily: "'Vazirmatn', sans-serif" }}>
            کافه‌بستنی تی‌تی
          </h1>
          {/* tagline */}
          <p className="mt-1.5 text-sm font-medium text-white/80">
            🧁 شیرین‌ترین لحظه‌های روزت اینجاست
          </p>
          <p className="mt-0.5 text-xs text-white/60">سفارش آنلاین — تحویل حضوری</p>

          {/* badge strip */}
          <div className="mt-4 flex items-center justify-center gap-3">
            {["🍨 بستنی سنتی", "☕ نوشیدنی", "🧁 دسر"].map((badge) => (
              <span key={badge} className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {badge}
              </span>
            ))}
          </div>
        </div>

        {/* wave */}
        <svg viewBox="0 0 390 48" preserveAspectRatio="none" className="absolute bottom-0 left-0 right-0 w-full" style={{ height: 48 }}>
          <path d="M0,24 C60,48 120,0 195,24 C270,48 330,0 390,24 L390,48 L0,48 Z"
            style={{ fill: "#FAF6EF" }} />
        </svg>
      </header>

      {/* ══ STICKY CATEGORY TABS ════════════════════════════════════════════ */}
      {menu && menu.length > 0 && (
        <nav className="no-scrollbar sticky top-0 z-20 flex gap-2 overflow-x-auto px-4 py-3 backdrop-blur-md"
          style={{ background: "rgba(250,246,239,0.92)" }}>
          {menu.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                ref={(el) => { tabRefs.current[cat.id] = el; }}
                type="button"
                onClick={() => scrollToCategory(cat.id)}
                className={[
                  "relative flex min-h-[44px] flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200",
                  isActive
                    ? "bg-saffron text-white shadow-md"
                    : "border border-saffron/30 bg-white text-ink hover:bg-saffron-light",
                ].join(" ")}>
                <span>{categoryEmoji(cat.name)}</span>
                <span>{cat.name}</span>
                {isActive && (
                  <span className="absolute -bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-saffron-dark" />
                )}
              </button>
            );
          })}
        </nav>
      )}

      {/* ══ MAIN ════════════════════════════════════════════════════════════ */}
      <main className="space-y-7 px-4 pt-2">

        {/* error */}
        {loadError && (
          <div className="flex items-center gap-3 rounded-2xl bg-berry-light px-4 py-3 text-sm text-berry shadow-sm">
            <span className="text-xl">⚠️</span>
            <span className="flex-1">{loadError}</span>
            <button type="button" onClick={() => loadMenu()}
              className="rounded-xl bg-berry px-3 py-1.5 text-xs font-bold text-white">
              تلاش دوباره
            </button>
          </div>
        )}

        {/* loading skeleton */}
        {!menu && !loadError && (
          <>
            <div className="flex gap-2 animate-pulse">
              {[80, 64, 96, 72].map((w, i) => (
                <div key={i} className="h-10 rounded-full bg-gray-200" style={{ width: w }} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          </>
        )}

        {/* empty */}
        {menu && menu.length === 0 && (
          <div className="flex flex-col items-center py-24 gap-3">
            <span className="text-6xl">🍦</span>
            <p className="text-gray-400 text-base font-medium">به‌زودی برمی‌گردیم!</p>
          </div>
        )}

        {/* ── featured row ── */}
        {menu && menu.length > 0 && featuredProducts.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold" style={{ color: "#B8791A" }}>
              <span>⭐</span> پیشنهاد ویژه تی‌تی
            </h2>
            <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
              {featuredProducts.map((product) => {
                const cat = (menu ?? []).find((c) => c.id === product.category_id);
                const qty = cart[product.id] ?? 0;
                return (
                  <div key={product.id}
                    className="flex w-[100px] flex-shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="h-[70px] w-full overflow-hidden">
                      <ProductImage product={product} catName={cat?.name ?? ""} size="full" />
                    </div>
                    <div className="flex flex-1 flex-col p-2">
                      <p className="line-clamp-2 text-center text-[10px] font-semibold leading-tight text-ink">
                        {product.name}
                      </p>
                      <p className="mt-0.5 text-center text-[10px] font-bold" style={{ color: "#B8791A" }}>
                        {formatToman(product.price)}
                      </p>
                      <button type="button"
                        onClick={() => setQty(product.id, qty + 1)}
                        className="mt-auto mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-saffron text-white text-sm font-bold">
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── category sections ── */}
        {menu?.map((cat) => (
          <section key={cat.id}
            ref={(el) => { sectionRefs.current[cat.id] = el; }}
            data-cat-id={cat.id}
            className="scroll-mt-20">

            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-ink">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-saffron-light text-lg">
                {categoryEmoji(cat.name)}
              </span>
              {cat.name}
            </h2>

            {/* card grid: if products have images → 2-col grid; else list */}
            {cat.products.some((p) => p.image_url) ? (
              <div className="grid grid-cols-2 gap-3">
                {cat.products.map((product) => (
                  <GridCard key={product.id} product={product} catName={cat.name}
                    qty={cart[product.id] ?? 0}
                    onQtyChange={(q) => setQty(product.id, q)} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {cat.products.map((product) => (
                  <ListCard key={product.id} product={product} catName={cat.name}
                    qty={cart[product.id] ?? 0}
                    onQtyChange={(q) => setQty(product.id, q)} />
                ))}
              </div>
            )}
          </section>
        ))}
      </main>

      {/* ══ CART BAR ════════════════════════════════════════════════════════ */}
      <div
        className={["fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg transition-transform duration-300",
          cartCount > 0 ? "translate-y-0" : "translate-y-full"].join(" ")}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-3 mb-3 overflow-hidden rounded-2xl shadow-xl"
          style={{ background: "linear-gradient(135deg, #33261D 0%, #4a3728 100%)" }}>
          <button type="button" onClick={() => setCheckoutOpen(true)}
            className="flex w-full items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3 text-white">
              {/* waffle cone decoration */}
              <span className="text-lg">🧇</span>
              <div>
                <p className="text-xs text-white/60">سبد خرید</p>
                <p className="text-sm font-bold">{formatToman(cartTotal)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-saffron text-xs font-bold text-white">
                {faNum(cartCount)}
              </span>
              <span className="rounded-xl bg-saffron px-4 py-2 text-sm font-bold text-white">
                ثبت سفارش ←
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* ══ CHECKOUT BOTTOM-SHEET ═══════════════════════════════════════════ */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50"
          onClick={() => !submitting && setCheckoutOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={(e) => e.stopPropagation()}>

            {/* handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-gray-200" />
            </div>

            {/* header strip */}
            <div className="mx-5 mt-2 flex items-center gap-2 rounded-2xl px-4 py-3"
              style={{ background: "linear-gradient(135deg, #E9A13B20, #B8791A10)" }}>
              <span className="text-2xl">🛒</span>
              <div>
                <p className="font-bold text-ink">سفارش شما</p>
                <p className="text-xs text-gray-400">کافه‌بستنی تی‌تی</p>
              </div>
            </div>

            <div className="px-5 pb-6 pt-4">
              {/* items */}
              <ul className="space-y-3">
                {cartLines.map((line) => (
                  <li key={line.product.id}
                    className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl">
                        <ProductImage product={line.product}
                          catName={(menu ?? []).find((c) => c.id === line.product.category_id)?.name ?? ""}
                          size="thumb" />
                      </div>
                      <span className="font-medium text-ink truncate">{line.product.name}</span>
                    </div>
                    <CartQty value={line.quantity} onChange={(q) => setQty(line.product.id, q)} disabled={submitting} />
                    <span className="w-24 text-left text-sm font-medium text-gray-500 flex-shrink-0">
                      {formatToman(line.product.price * line.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="receipt-divider my-4" />

              <div className="flex items-center justify-between font-bold">
                <span className="text-ink">جمع کل</span>
                <span style={{ color: "#B8791A" }}>{formatToman(cartTotal)}</span>
              </div>
              <p className="mt-1 text-xs text-gray-400">💳 پرداخت حضوری داخل کافه انجام می‌شود</p>

              <div className="mt-5 space-y-3">
                <input type="text" value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="اسم شما (اختیاری — برای صدا زدن)"
                  maxLength={100} disabled={submitting}
                  className="w-full rounded-xl border border-gray-200 bg-cream p-3 text-sm outline-none focus:border-saffron disabled:opacity-50" />
                <textarea value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="توضیحات (اختیاری — مثلاً: بدون شکر)"
                  maxLength={500} rows={2} disabled={submitting}
                  className="w-full rounded-xl border border-gray-200 bg-cream p-3 text-sm outline-none focus:border-saffron disabled:opacity-50" />
              </div>

              {submitError && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-berry-light p-3 text-sm text-berry">
                  <span>⚠️</span><span>{submitError}</span>
                </div>
              )}

              <div className="mt-5 flex gap-2">
                <button type="button" disabled={submitting} onClick={submitOrder}
                  className="flex-1 rounded-xl bg-saffron px-4 py-3 font-bold text-white transition-opacity hover:bg-saffron-dark disabled:opacity-50">
                  {submitting ? "در حال ثبت…" : "✅ ثبت نهایی سفارش"}
                </button>
                <button type="button" disabled={submitting} onClick={() => setCheckoutOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-ink">
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

// ── Grid card (when product has image) ────────────────────────────────────────
function GridCard({ product, catName, qty, onQtyChange }: {
  product: Product; catName: string; qty: number; onQtyChange: (q: number) => void;
}) {
  const inCart = qty > 0;
  const unavailable = !product.is_available;
  return (
    <div className={[
      "relative overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-200",
      inCart ? "ring-2 ring-saffron" : "",
      unavailable ? "opacity-50" : "",
    ].join(" ")}>
      <div className="h-36 w-full overflow-hidden">
        <ProductImage product={product} catName={catName} size="full" />
      </div>
      {unavailable && (
        <span className="absolute left-2 top-2 rounded-lg bg-berry px-2 py-0.5 text-[10px] font-bold text-white">
          ناموجود
        </span>
      )}
      {inCart && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-saffron text-[10px] font-bold text-white">
          {qty}
        </span>
      )}
      <div className="p-3">
        <p className="font-bold text-sm text-ink leading-snug">{product.name}</p>
        {product.description && (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-400">{product.description}</p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs font-bold" style={{ color: "#B8791A" }}>
            {formatToman(product.price)}
          </span>
          <CartQty value={qty} onChange={onQtyChange} disabled={unavailable} />
        </div>
      </div>
    </div>
  );
}

// ── List card (no image) ──────────────────────────────────────────────────────
function ListCard({ product, catName, qty, onQtyChange }: {
  product: Product; catName: string; qty: number; onQtyChange: (q: number) => void;
}) {
  const inCart = qty > 0;
  const unavailable = !product.is_available;
  return (
    <div className={[
      "relative flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm transition-all duration-200",
      inCart ? "border-r-4 border-saffron bg-saffron/5" : "",
      unavailable ? "opacity-50" : "",
    ].join(" ")}>
      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl">
        <ProductImage product={product} catName={catName} size="full" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink">{product.name}</p>
        {product.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">{product.description}</p>
        )}
        <p className="mt-1 text-sm font-bold" style={{ color: "#B8791A" }}>
          {formatToman(product.price)}
        </p>
      </div>
      <div className="flex-shrink-0">
        <CartQty value={qty} onChange={onQtyChange} disabled={unavailable} />
      </div>
      {unavailable && (
        <span className="absolute left-3 top-3 rounded-md bg-berry px-2 py-0.5 text-[10px] font-bold text-white">
          ناموجود
        </span>
      )}
    </div>
  );
}
