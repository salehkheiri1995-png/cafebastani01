import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import QtyControl from "../components/QtyControl";
import type { MenuCategory, Order, Product } from "../types";
import { faNum, formatToman } from "../utils/format";
import { resolveImageUrl } from "../utils/image";

// ═══ emoji بر اساس نام دسته ═══════════════════════════════════════════════════
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

// ═══ رنگ گرادینت هر دسته ════════════════════════════════════════════════════
function categoryGradient(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("بستنی") || n.includes("آیس")) return "from-pink-100 via-rose-50 to-orange-50";
  if (n.includes("قهوه") || n.includes("کافه")) return "from-amber-50 via-yellow-50 to-orange-50";
  if (n.includes("آبمیوه") || n.includes("نوشیدنی")) return "from-green-50 via-emerald-50 to-teal-50";
  if (n.includes("کیک") || n.includes("شیرینی")) return "from-purple-50 via-pink-50 to-rose-50";
  if (n.includes("میلک") || n.includes("شیک")) return "from-blue-50 via-cyan-50 to-sky-50";
  return "from-saffron-light via-cream to-white";
}

// ═══ اسکلتون لودینگ ═════════════════════════════════════════════════════════
function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl bg-white shadow-soft">
      <div className="h-40 w-full bg-gradient-to-br from-gray-100 to-gray-50" />
      <div className="p-3.5 space-y-2.5">
        <div className="h-4 w-3/4 rounded-lg bg-gray-100" />
        <div className="h-3 w-full rounded bg-gray-50" />
        <div className="flex items-center justify-between">
          <div className="h-5 w-16 rounded bg-saffron-light" />
          <div className="h-8 w-20 rounded-full bg-saffron-light" />
        </div>
      </div>
    </div>
  );
}

function SkeletonFeatured() {
  return (
    <div className="animate-pulse flex gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex w-28 flex-shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-soft">
          <div className="h-24 w-full bg-gradient-to-br from-gray-100 to-gray-50" />
          <div className="p-2 space-y-1.5">
            <div className="h-3 w-3/4 rounded bg-gray-100 mx-auto" />
            <div className="h-3 w-1/2 rounded bg-saffron-light mx-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══ کنترل تعداد با استایل سفارشی ══════════════════════════════════════════
interface QtyProps { value: number; onChange: (q: number) => void; disabled?: boolean; compact?: boolean; }
function CartQty({ value, onChange, disabled, compact }: QtyProps) {
  return <QtyControl value={value} onChange={onChange} disabled={disabled} compact={compact} />;
}

// ═══ تصویر محصول با فال‌بک ═════════════════════════════════════════════════
function ProductImage({ product, catName, size = "full" }: { product: Product; catName: string; size?: "full" | "thumb" }) {
  const [err, setErr] = useState(false);
  if (product.image_url && !err) {
    return (
      <img
        src={resolveImageUrl(product.image_url) ?? undefined}
        alt={product.name}
        onError={() => setErr(true)}
        className={`w-full object-cover transition-transform duration-500 hover:scale-110 ${
          size === "full" ? "h-full" : "h-full"
        }`}
        loading="lazy"
      />
    );
  }
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br ${categoryGradient(catName)}`}>
      <span className={`${size === "full" ? "text-5xl" : "text-3xl"} animate-float`}>
        {categoryEmoji(catName)}
      </span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
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

  // ── بارگذاری منو + رفرش خودکار ۳۰ ثانیه ────────────────────────────────────
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
      if (!silent) {
        if (e instanceof ApiError && e.status === 503) {
          setLoadError("__CLOSED__");
        } else {
          setLoadError(e instanceof ApiError ? e.message : "خطا در دریافت منو");
        }
      }
    }
  }, []);

  useEffect(() => {
    loadMenu();
    const timer = setInterval(() => loadMenu(true), 30_000);
    return () => clearInterval(timer);
  }, [loadMenu]);

  // ── IntersectionObserver برای تب فعال ──────────────────────────────────────
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

  // ── مقادیر مشتقه ──────────────────────────────────────────────────────────
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

  // ── عملیات ─────────────────────────────────────────────────────────────────
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
      if (e instanceof ApiError && e.status === 503) {
        setCheckoutOpen(false);
        setLoadError("__CLOSED__");
      } else {
        setSubmitError(e instanceof ApiError ? e.message : "ثبت سفارش ناموفق بود — دوباره تلاش کنید");
        loadMenu(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToCategory = (id: number) => {
    setActiveCategory(id);
    tabRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ═══ رندر ══════════════════════════════════════════════════════════════════
  return (
    <div className="relative mx-auto min-h-screen max-w-lg pb-32" dir="rtl">

      {/* ══ هدر اصلی ════════════════════════════════════════════════════════ */}
      <header className="relative overflow-hidden gradient-header">

        {/* حلقه‌های تزئینی */}
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/[0.07]" />
        <div className="pointer-events-none absolute top-8 -left-8 h-28 w-28 rounded-full bg-white/[0.05]" />
        <div className="pointer-events-none absolute -bottom-4 right-20 h-20 w-20 rounded-full bg-saffron/20" />
        <div className="pointer-events-none absolute top-2 left-1/3 h-16 w-16 rounded-full bg-white/[0.04]" />

        {/* نقاط تزئینی */}
        <div className="pointer-events-none absolute inset-0 dot-pattern opacity-30" />

        <div className="relative px-5 pb-16 pt-12 text-center">
          {/* لوگو */}
          <div className="mb-3 flex items-center justify-center gap-3">
            <span className="text-4xl animate-float" style={{ animationDelay: "0s" }}>🍨</span>
            <div className="relative">
              <span className="text-5xl animate-float" style={{ animationDelay: "0.3s" }}>🍦</span>
              <div className="absolute -bottom-1 left-1/2 h-2 w-8 -translate-x-1/2 rounded-full bg-black/10 blur-sm" />
            </div>
            <span className="text-4xl animate-float" style={{ animationDelay: "0.6s" }}>🍧</span>
          </div>

          {/* نام کافه */}
          <h1 className="font-vazir text-3xl font-black tracking-wide text-white drop-shadow-lg">
            کافه‌بستنی تی‌تی
          </h1>

          {/* شعار تبلیغاتی */}
          <p className="mt-2 text-sm font-medium text-white/85 drop-shadow">
            شیرین‌ترین لحظه‌های روزت اینجاست
          </p>
          <p className="mt-1 text-xs text-white/55">
            سفارش آنلاین — تحویل حضوری
          </p>

          {/* نوار برچسب‌ها */}
          <div className="mt-5 flex items-center justify-center gap-2.5">
            {[
              { text: "بستنی سنتی", emoji: "🍨" },
              { text: "نوشیدنی", emoji: "☕" },
              { text: "دسر", emoji: "🧁" },
            ].map((badge) => (
              <span key={badge.text}
                className="glass rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink/80 shadow-soft">
                <span className="ml-1">{badge.emoji}</span>
                {badge.text}
              </span>
            ))}
          </div>
        </div>

        {/* موج پایین هدر */}
        <svg viewBox="0 0 390 56" preserveAspectRatio="none"
          className="absolute bottom-0 left-0 right-0 w-full" style={{ height: 56 }}>
          <path d="M0,28 C48,56 96,0 144,28 C192,56 240,0 288,28 C336,56 384,0 390,28 L390,56 L0,56 Z"
            fill="#FAF6EF" />
          <path d="M0,40 C60,56 120,20 195,40 C270,56 330,20 390,40 L390,56 L0,56 Z"
            fill="#FAF6EF" opacity="0.5" />
        </svg>
      </header>

      {/* ══ تب‌های دسته‌بندی (چسبان) ═══════════════════════════════════════ */}
      {menu && menu.length > 0 && (
        <nav className="no-scrollbar sticky top-0 z-20 glass border-b border-saffron/10 px-4 py-3">
          <div className="flex gap-2 overflow-x-auto">
            {menu.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  ref={(el) => { tabRefs.current[cat.id] = el; }}
                  type="button"
                  onClick={() => scrollToCategory(cat.id)}
                  className={`relative flex min-h-[42px] flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition-all duration-300 ${
                    isActive
                      ? "gradient-saffron text-white shadow-warm scale-[1.02]"
                      : "bg-white text-ink/70 hover:bg-saffron-light hover:text-ink shadow-soft"
                  }`}>
                  <span className="text-base">{categoryEmoji(cat.name)}</span>
                  <span>{cat.name}</span>
                  {isActive && (
                    <span className="absolute -bottom-2 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-saffron" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* ══ محتوای اصلی ═════════════════════════════════════════════════════ */}
      <main className="space-y-8 px-4 pt-4">

        {/* خطا */}
        {loadError && loadError !== "__CLOSED__" && (
          <div className="animate-fade-in-up flex items-center gap-3 rounded-2xl bg-berry-light p-4 text-sm text-berry shadow-soft">
            <span className="text-xl">⚠️</span>
            <span className="flex-1 font-medium">{loadError}</span>
            <button type="button" onClick={() => loadMenu()}
              className="rounded-xl bg-berry px-4 py-2 text-xs font-bold text-white transition-all hover:bg-berry/90 active:scale-95">
              تلاش دوباره
            </button>
          </div>
        )}

        {/* حالت تعطیل */}
        {loadError === "__CLOSED__" && (
          <div className="animate-fade-in-up flex flex-col items-center py-20 gap-5">
            <span className="text-7xl animate-float">😴</span>
            <div className="text-center">
              <p className="text-xl font-black" style={{ color: "#33261D" }}>
                کافه بسته است!
              </p>
              <p className="mt-2 text-sm" style={{ color: "rgba(51,38,29,0.5)" }}>
                در حال حاضر پذیرش سفارش نداریم
              </p>
              <p className="mt-1 text-xs" style={{ color: "rgba(51,38,29,0.35)" }}>
                لطفاً بعداً دوباره سر بزنید 🙏
              </p>
            </div>
            <button type="button" onClick={() => loadMenu()}
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #E9A13B, #B8791A)" }}>
              تلاش دوباره
            </button>
          </div>
        )}

        {/* اسکلتون لودینگ */}
        {!menu && !loadError && (
          <div className="space-y-6">
            <SkeletonFeatured />
            <div className="grid grid-cols-2 gap-3">
              <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          </div>
        )}

        {/* حالت خالی */}
        {menu && menu.length === 0 && (
          <div className="flex flex-col items-center py-28 gap-4">
            <span className="text-7xl animate-float">🍦</span>
            <p className="text-lg font-bold text-ink/40">به‌زودی برمی‌گردیم!</p>
          </div>
        )}

        {/* ══ پیشنهاد ویژه ═══════════════════════════════════════════════════ */}
        {menu && menu.length > 0 && featuredProducts.length > 0 && (
          <section className="animate-fade-in-up">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-saffron/10">
                <span className="text-sm">⭐</span>
              </div>
              <h2 className="text-base font-black text-ink">پیشنهاد ویژه تی‌تی</h2>
            </div>

            <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
              {featuredProducts.map((product, idx) => {
                const cat = (menu ?? []).find((c) => c.id === product.category_id);
                const qty = cart[product.id] ?? 0;
                return (
                  <div key={product.id}
                    className={`animate-fade-in-up stagger-${Math.min(idx + 1, 6)} flex w-[110px] flex-shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-white shadow-soft hover-lift`}>
                    {/* تصویر */}
                    <div className="relative h-24 w-full overflow-hidden rounded-t-2xl">
                      <ProductImage product={product} catName={cat?.name ?? ""} size="full" />
                      {qty > 0 && (
                        <span className="animate-bounce-in absolute left-2 top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-saffron px-1 text-[10px] font-bold text-white shadow-warm">
                          {faNum(qty)}
                        </span>
                      )}
                    </div>
                    {/* اطلاعات */}
                    <div className="flex flex-1 flex-col p-2.5 text-center">
                      <p className="line-clamp-2 text-[11px] font-bold leading-tight text-ink">
                        {product.name}
                      </p>
                      <p className="mt-1 text-[11px] font-black text-saffron-dark">
                        {formatToman(product.price)}
                      </p>
                      <button type="button"
                        onClick={() => setQty(product.id, qty + 1)}
                        className="mt-auto mx-auto mt-2 flex h-7 w-7 items-center justify-center rounded-full gradient-saffron text-white text-sm font-bold shadow-warm transition-all active:scale-90">
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ══ بخش‌های دسته‌بندی ═════════════════════════════════════════════ */}
        {menu?.map((cat, catIdx) => (
          <section key={cat.id}
            ref={(el) => { sectionRefs.current[cat.id] = el; }}
            data-cat-id={cat.id}
            className={`scroll-mt-20 animate-fade-in-up stagger-${Math.min(catIdx + 1, 6)}`}>

            {/* عنوان دسته */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-saffron-light to-saffron/20 text-xl shadow-soft">
                {categoryEmoji(cat.name)}
              </div>
              <div>
                <h2 className="text-lg font-black text-ink">{cat.name}</h2>
                <p className="text-xs text-ink/40">{cat.products.length} آیتم</p>
              </div>
            </div>

            {/* نمایش کارتی یا لیستی بر اساس وجود تصویر */}
            {cat.products.some((p) => p.image_url) ? (
              <div className="grid grid-cols-2 gap-3">
                {cat.products.map((product) => (
                  <GridCard key={product.id} product={product} catName={cat.name}
                    qty={cart[product.id] ?? 0}
                    onQtyChange={(q) => setQty(product.id, q)} />
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
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

      {/* ══ نوار سبد خرید ════════════════════════════════════════════════════ */}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg transition-all duration-500 ease-out ${
          cartCount > 0 ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-3 mb-3 overflow-hidden rounded-2xl shadow-elevated"
          style={{ background: "linear-gradient(135deg, #33261D 0%, #4a3728 50%, #33261D 100%)" }}>
          <button type="button" onClick={() => setCheckoutOpen(true)}
            className="flex w-full items-center justify-between px-5 py-4 transition-all active:scale-[0.98]">
            <div className="flex items-center gap-3 text-white">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-saffron/20 text-lg">
                🧇
              </div>
              <div className="text-right">
                <p className="text-xs text-white/50">سبد خرید</p>
                <p className="text-sm font-black">{formatToman(cartTotal)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-saffron px-2 text-xs font-bold text-white shadow-warm animate-pulse-glow">
                {faNum(cartCount)}
              </span>
              <span className="rounded-xl gradient-saffron px-5 py-2.5 text-sm font-bold text-white shadow-warm transition-all">
                ثبت سفارش ←
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* ══ شیت چک‌اوت ══════════════════════════════════════════════════════ */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/60 backdrop-blur-sm transition-opacity"
          onClick={() => !submitting && setCheckoutOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-elevated animate-fade-in-up"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={(e) => e.stopPropagation()}>

            {/* دستگیره */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-gray-200" />
            </div>

            {/* هدر */}
            <div className="mx-5 mt-2 flex items-center gap-3 rounded-2xl px-4 py-3.5 gradient-saffron">
              <span className="text-2xl">🛒</span>
              <div>
                <p className="font-bold text-white">سفارش شما</p>
                <p className="text-xs text-white/70">کافه‌بستنی تی‌تی</p>
              </div>
            </div>

            <div className="px-5 pb-6 pt-5">
              {/* آیتم‌ها */}
              <ul className="space-y-3">
                {cartLines.map((line) => (
                  <li key={line.product.id}
                    className="animate-slide-in-right flex items-center justify-between gap-3 rounded-xl bg-cream/50 p-3 text-sm">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-xl shadow-soft">
                        <ProductImage product={line.product}
                          catName={(menu ?? []).find((c) => c.id === line.product.category_id)?.name ?? ""}
                          size="thumb" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-ink truncate">{line.product.name}</p>
                        <p className="text-xs text-ink/40">{formatToman(line.product.price)}</p>
                      </div>
                    </div>
                    <CartQty value={line.quantity} onChange={(q) => setQty(line.product.id, q)} disabled={submitting} compact />
                    <span className="w-20 text-left text-sm font-bold text-saffron-dark flex-shrink-0">
                      {formatToman(line.product.price * line.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="receipt-divider my-5" />

              {/* جمع کل */}
              <div className="flex items-center justify-between rounded-xl bg-saffron-light/50 px-4 py-3">
                <span className="font-bold text-ink">جمع کل</span>
                <span className="text-lg font-black text-saffron-dark">{formatToman(cartTotal)}</span>
              </div>
              <p className="mt-2 text-center text-xs text-ink/40">💳 پرداخت حضوری داخل کافه انجام می‌شود</p>

              {/* فرم اطلاعات */}
              <div className="mt-5 space-y-3">
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/30">👤</span>
                  <input type="text" value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="اسم شما (اختیاری — برای صدا زدن)"
                    maxLength={100} disabled={submitting}
                    className="w-full rounded-xl border border-saffron/20 bg-cream pr-10 p-3 text-sm outline-none transition-all focus:border-saffron focus:shadow-warm disabled:opacity-50" />
                </div>
                <div className="relative">
                  <span className="absolute right-3 top-3 text-ink/30">📝</span>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="توضیحات (اختیاری — مثلاً: بدون شکر)"
                    maxLength={500} rows={2} disabled={submitting}
                    className="w-full rounded-xl border border-saffron/20 bg-cream pr-10 p-3 text-sm outline-none transition-all focus:border-saffron focus:shadow-warm disabled:opacity-50 resize-none" />
                </div>
              </div>

              {/* خطا */}
              {submitError && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-berry-light p-3 text-sm text-berry animate-fade-in-up">
                  <span>⚠️</span><span className="font-medium">{submitError}</span>
                </div>
              )}

              {/* دکمه‌ها */}
              <div className="mt-5 flex gap-3">
                <button type="button" disabled={submitting} onClick={submitOrder}
                  className="flex-1 rounded-xl gradient-saffron px-4 py-3.5 font-bold text-white shadow-warm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50">
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      در حال ثبت…
                    </span>
                  ) : "✅ ثبت نهایی سفارش"}
                </button>
                <button type="button" disabled={submitting} onClick={() => setCheckoutOpen(false)}
                  className="rounded-xl border-2 border-saffron/20 px-5 py-3.5 text-sm font-bold text-ink transition-all hover:bg-saffron-light active:scale-[0.98]">
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

// ═══ کارت شبکه‌ای (وقتی محصول تصویر دارد) ═══════════════════════════════════
function GridCard({ product, catName, qty, onQtyChange }: {
  product: Product; catName: string; qty: number; onQtyChange: (q: number) => void;
}) {
  const inCart = qty > 0;
  const unavailable = !product.is_available;
  return (
    <div className={`animate-fade-in-up relative overflow-hidden rounded-2xl bg-white shadow-soft transition-all duration-300 hover-lift ${
      inCart ? "ring-2 ring-saffron shadow-warm" : ""
    } ${unavailable ? "opacity-40 grayscale" : ""}`}>
      {/* تصویر */}
      <div className="relative h-40 w-full overflow-hidden rounded-t-2xl">
        <ProductImage product={product} catName={catName} size="full" />
        {/* بج ناموجود */}
        {unavailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-lg bg-berry px-3 py-1.5 text-xs font-bold text-white shadow-lg">
              ناموجود
            </span>
          </div>
        )}
        {/* بج تعداد */}
        {inCart && (
          <span className="animate-bounce-in absolute left-2 top-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-saffron px-1.5 text-xs font-bold text-white shadow-warm">
            {faNum(qty)}
          </span>
        )}
      </div>
      {/* اطلاعات */}
      <div className="p-3">
        <p className="font-bold text-sm text-ink leading-snug line-clamp-1">{product.name}</p>
        {product.description && (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-ink/40">{product.description}</p>
        )}
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-sm font-black text-saffron-dark">
            {formatToman(product.price)}
          </span>
          <CartQty value={qty} onChange={onQtyChange} disabled={unavailable} compact />
        </div>
      </div>
    </div>
  );
}

// ═══ کارت لیستی (بدون تصویر) ═══════════════════════════════════════════════
function ListCard({ product, catName, qty, onQtyChange }: {
  product: Product; catName: string; qty: number; onQtyChange: (q: number) => void;
}) {
  const inCart = qty > 0;
  const unavailable = !product.is_available;
  return (
    <div className={`animate-fade-in-up relative flex items-center gap-4 rounded-2xl bg-white p-4 shadow-soft transition-all duration-300 hover-lift ${
      inCart ? "ring-1 ring-saffron/30 bg-saffron/[0.03] shadow-warm" : ""
    } ${unavailable ? "opacity-40 grayscale" : ""}`}>
      {/* تصویر / ایموجی */}
      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl shadow-soft">
        <ProductImage product={product} catName={catName} size="full" />
      </div>
      {/* اطلاعات */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-bold text-ink">{product.name}</p>
          {unavailable && (
            <span className="rounded-md bg-berry px-1.5 py-0.5 text-[9px] font-bold text-white">ناموجود</span>
          )}
        </div>
        {product.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-ink/40">{product.description}</p>
        )}
      </div>
      {/* قیمت و کنترل */}
      <div className="flex flex-shrink-0 items-center gap-3">
        <span className="text-sm font-black text-saffron-dark whitespace-nowrap">
          {formatToman(product.price)}
        </span>
        <CartQty value={qty} onChange={onQtyChange} disabled={unavailable} />
      </div>
    </div>
  );
}
