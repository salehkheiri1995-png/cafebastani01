import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import QtyControl from "../components/QtyControl";
import type { MenuCategory, Order, Product } from "../types";
import { categoryEmoji, categoryGradient } from "../utils/category";
import { faNum, formatToman } from "../utils/format";
import { resolveImageUrl } from "../utils/image";

/** مقدار ویژه خطا: کافه بسته است (بک‌اند 503 برمی‌گرداند) */
const CLOSED = "__CLOSED__";

/** کلید یکتای جلوگیری از ثبت تکراری سفارش (تلاش مجدد = همان سفارش) */
function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ═══ اسکلتون لودینگ ═════════════════════════════════════════════════════════
function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl bg-white shadow-card">
      <div className="h-36 w-full bg-gradient-to-br from-cream-200 to-cream-50" />
      <div className="space-y-2.5 p-3.5">
        <div className="h-4 w-3/4 rounded-lg bg-cream-200" />
        <div className="h-3 w-full rounded bg-cream-100" />
        <div className="flex items-center justify-between">
          <div className="h-5 w-16 rounded bg-saffron-100" />
          <div className="h-8 w-20 rounded-full bg-saffron-100" />
        </div>
      </div>
    </div>
  );
}

function SkeletonFeatured() {
  return (
    <div className="animate-pulse flex gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex w-28 flex-shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-card">
          <div className="h-24 w-full bg-gradient-to-br from-cream-200 to-cream-50" />
          <div className="space-y-1.5 p-2">
            <div className="mx-auto h-3 w-3/4 rounded bg-cream-200" />
            <div className="mx-auto h-3 w-1/2 rounded bg-saffron-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══ تصویر محصول با فال‌بک ═════════════════════════════════════════════════
const ProductImage = memo(function ProductImage({
  product,
  catName,
  size = "full",
}: {
  product: Product;
  catName: string;
  size?: "full" | "thumb";
}) {
  const [err, setErr] = useState(false);
  if (product.image_url && !err) {
    return (
      <img
        src={resolveImageUrl(product.image_url) ?? undefined}
        alt={product.name}
        onError={() => setErr(true)}
        className="h-full w-full object-cover transition-transform duration-500 ease-out-quint group-hover:scale-105"
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${categoryGradient(catName)}`}>
      <span className={size === "full" ? "text-5xl" : "text-3xl"} aria-hidden="true">
        {categoryEmoji(catName)}
      </span>
    </div>
  );
});

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
  const menuRef = useRef<MenuCategory[] | null>(null);
  menuRef.current = menu;
  const lastPayloadRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const idemKeyRef = useRef<string | null>(null);

  // ── بارگذاری منو + رفرش خودکار ۳۰ ثانیه ────────────────────────────────────
  const loadMenu = useCallback(async (silent = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await api.get<MenuCategory[]>("/api/menu", { signal: controller.signal });

      // اگر پاسخ با نسخه قبلی یکسان است، state عوض نمی‌شود → رندر اضافه نداریم
      const payload = JSON.stringify(data);
      const changed = payload !== lastPayloadRef.current;
      lastPayloadRef.current = payload;

      setMenu((prev) => (changed || prev === null ? data : prev));
      if (changed) {
        setActiveCategory((prev) => prev ?? (data[0]?.id ?? null));
        const availableIds = new Set(data.flatMap((c) => c.products.map((p) => p.id)));
        setCart((prev) => {
          let dirty = false;
          const next: Record<number, number> = {};
          for (const [id, qty] of Object.entries(prev)) {
            if (availableIds.has(Number(id))) next[Number(id)] = qty;
            else dirty = true;
          }
          return dirty ? next : prev;
        });
      }
      setLoadError(null);
    } catch (e) {
      if (controller.signal.aborted) return;
      if (!silent) {
        if (e instanceof ApiError && e.status === 503) setLoadError(CLOSED);
        else setLoadError(e instanceof ApiError ? e.message : "خطا در دریافت منو");
      }
    }
  }, []);

  // رفرش خودکار — هنگام مخفی بودن تب متوقف می‌شود تا باتری و ترافیک هدر نرود
  useEffect(() => {
    let timer: number | undefined;
    const stop = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };
    const start = () => {
      stop();
      timer = window.setInterval(() => loadMenu(true), 30_000);
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        loadMenu(true);
        start();
      }
    };
    loadMenu();
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      abortRef.current?.abort();
    };
  }, [loadMenu]);

  // ── IntersectionObserver برای تب فعال (فقط با تغییر لیست دسته‌ها) ─────────
  const catSignature = menu?.map((c) => c.id).join(",") ?? "";
  useEffect(() => {
    if (!catSignature) return;
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
    for (const id of catSignature.split(",")) {
      const el = sectionRefs.current[Number(id)];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [catSignature]);

  // ── مقادیر مشتقه ──────────────────────────────────────────────────────────
  const allProducts = useMemo(() => (menu ?? []).flatMap((c) => c.products), [menu]);
  const cartLines = useMemo(
    () => allProducts.filter((p) => (cart[p.id] ?? 0) > 0).map((p) => ({ product: p, quantity: cart[p.id] })),
    [allProducts, cart],
  );
  const cartCount = cartLines.reduce((s, l) => s + l.quantity, 0);
  const cartTotal = cartLines.reduce((s, l) => s + l.product.price * l.quantity, 0);

  // نگاشت سریع category_id → نام (به جای find داخل حلقه‌های رندر)
  const catNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of menu ?? []) map.set(c.id, c.name);
    return map;
  }, [menu]);

  const featuredProducts = useMemo(
    () => (menu ?? []).flatMap((c) => c.products.filter((p) => p.is_available).slice(0, 1)).slice(0, 6),
    [menu],
  );

  // ── عملیات ─────────────────────────────────────────────────────────────────
  const setQty = useCallback((productId: number, qty: number) => {
    // تغییر سبد = قصد خرید جدید → کلید یکتای سفارش هم عوض می‌شود
    idemKeyRef.current = null;
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  }, []);

  const submitOrder = async () => {
    if (cartLines.length === 0 || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    if (!idemKeyRef.current) idemKeyRef.current = newIdempotencyKey();
    try {
      const order = await api.post<Order>("/api/orders", {
        items: cartLines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
        customer_name: customerName.trim() || null,
        note: note.trim() || null,
        // جلوگیری از ثبت دوباره سفارش در اثر دوبار کلیک یا تلاش مجدد
        idempotency_key: idemKeyRef.current,
      });
      idemKeyRef.current = null;
      navigate(`/order/${order.code}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        setCheckoutOpen(false);
        setLoadError(CLOSED);
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

  // بستن شیت چک‌اوت با کلید Escape
  useEffect(() => {
    if (!checkoutOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) setCheckoutOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [checkoutOpen, submitting]);

  const closed = loadError === CLOSED;

  // ═══ رندر ══════════════════════════════════════════════════════════════════
  return (
    <div className="relative mx-auto min-h-screen max-w-lg pb-32" dir="rtl">

      {/* ══ هدر اصلی ════════════════════════════════════════════════════════ */}
      <header className="relative overflow-hidden gradient-header">
        {/* حلقه‌های تزئینی */}
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/[0.07]" />
        <div className="pointer-events-none absolute top-8 -left-8 h-28 w-28 rounded-full bg-white/[0.05]" />
        <div className="pointer-events-none absolute -bottom-4 right-20 h-20 w-20 rounded-full bg-saffron/20" />
        {/* نقاط تزئینی */}
        <div className="dot-pattern pointer-events-none absolute inset-0 opacity-25" />

        <div className="relative px-5 pb-16 pt-10 text-center">
          {/* نشان برند */}
          <div className="mx-auto mb-4 flex h-16 w-16 animate-float items-center justify-center rounded-3xl bg-white/15 text-3xl shadow-lg ring-1 ring-white/25 backdrop-blur-sm">
            <span aria-hidden="true">🍨</span>
          </div>

          {/* نام کافه */}
          <h1 className="font-display text-4xl leading-tight text-white drop-shadow-md">
            کافه‌بستنی تی‌تی
          </h1>

          {/* شعار تبلیغاتی */}
          <p className="mt-1.5 text-sm font-medium text-white/85">
            شیرین‌ترین لحظه‌های روزت اینجاست
          </p>
          <p className="mt-0.5 text-2xs tracking-wide text-white/55">
            سفارش آنلاین — تحویل حضوری
          </p>

          {/* نوار برچسب‌ها */}
          <div className="mt-5 flex items-center justify-center gap-2">
            {[
              { text: "بستنی سنتی", emoji: "🍨" },
              { text: "نوشیدنی", emoji: "☕" },
              { text: "دسر", emoji: "🧁" },
            ].map((badge) => (
              <span
                key={badge.text}
                className="glass rounded-full px-3 py-1.5 text-2xs font-semibold text-ink/75 ring-1 ring-white/60"
              >
                <span className="ml-1" aria-hidden="true">{badge.emoji}</span>
                {badge.text}
              </span>
            ))}
          </div>
        </div>

        {/* موج پایین هدر */}
        <svg viewBox="0 0 390 56" preserveAspectRatio="none" aria-hidden="true"
          className="absolute bottom-0 left-0 right-0 w-full" style={{ height: 56 }}>
          <path d="M0,28 C48,56 96,0 144,28 C192,56 240,0 288,28 C336,56 384,0 390,28 L390,56 L0,56 Z"
            fill="#FAF6EF" />
          <path d="M0,40 C60,56 120,20 195,40 C270,56 330,20 390,40 L390,56 L0,56 Z"
            fill="#FAF6EF" opacity="0.5" />
        </svg>
      </header>

      {/* ══ تب‌های دسته‌بندی (چسبان) ═══════════════════════════════════════ */}
      {menu && menu.length > 0 && (
        <nav aria-label="دسته‌بندی‌ها"
          className="no-scrollbar sticky top-0 z-20 border-b border-saffron/10 glass px-4 py-2.5 shadow-[0_10px_24px_-18px_rgba(46,35,27,0.6)]">
          <div className="flex gap-2 overflow-x-auto">
            {menu.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  ref={(el) => { tabRefs.current[cat.id] = el; }}
                  type="button"
                  onClick={() => scrollToCategory(cat.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={`relative flex min-h-[40px] flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition-all duration-300 ease-out-quint ${
                    isActive
                      ? "gradient-saffron text-white shadow-warm"
                      : "bg-white/90 text-ink-soft hover:bg-saffron-100 hover:text-ink shadow-soft"
                  }`}
                >
                  <span className="text-base" aria-hidden="true">{categoryEmoji(cat.name)}</span>
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* ══ محتوای اصلی ═════════════════════════════════════════════════════ */}
      <main className="space-y-8 px-4 pt-5">

        {/* خطا */}
        {loadError && !closed && (
          <div className="animate-fade-in-up flex items-center gap-3 rounded-2xl bg-berry-light p-4 text-sm text-berry shadow-soft" role="alert">
            <span className="text-xl" aria-hidden="true">⚠️</span>
            <span className="flex-1 font-medium">{loadError}</span>
            <button type="button" onClick={() => loadMenu()}
              className="rounded-xl bg-berry px-4 py-2 text-2xs font-bold text-white transition-all hover:bg-berry-dark active:scale-95">
              تلاش دوباره
            </button>
          </div>
        )}

        {/* حالت تعطیل */}
        {closed && (
          <div className="animate-fade-in-up flex flex-col items-center gap-5 py-20">
            <span className="text-7xl animate-float" aria-hidden="true">😴</span>
            <div className="text-center">
              <p className="font-display text-2xl text-ink">کافه بسته است!</p>
              <p className="mt-1.5 text-sm text-ink-muted">در حال حاضر پذیرش سفارش نداریم</p>
              <p className="mt-1 text-xs text-ink-faint">لطفاً بعداً دوباره سر بزنید 🙏</p>
            </div>
            <button type="button" onClick={() => loadMenu()}
              className="gradient-saffron rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-warm transition-all active:scale-95">
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
          <div className="flex flex-col items-center gap-4 py-28">
            <span className="text-7xl animate-float" aria-hidden="true">🍦</span>
            <p className="font-display text-xl text-ink-faint">به‌زودی برمی‌گردیم!</p>
          </div>
        )}

        {/* ══ پیشنهاد ویژه ═══════════════════════════════════════════════════ */}
        {menu && menu.length > 0 && featuredProducts.length > 0 && (
          <section aria-label="پیشنهاد ویژه" className="animate-fade-in-up">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-saffron-100">
                <span className="text-sm" aria-hidden="true">⭐</span>
              </div>
              <h2 className="font-display text-xl text-ink">پیشنهاد ویژه تی‌تی</h2>
            </div>

            <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
              {featuredProducts.map((product, idx) => {
                const qty = cart[product.id] ?? 0;
                return (
                  <div key={product.id}
                    className={`animate-fade-in-up stagger-${Math.min(idx + 1, 6)} group flex w-[110px] flex-shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-white shadow-card hover-lift`}>
                    {/* تصویر */}
                    <div className="relative h-24 w-full overflow-hidden rounded-t-2xl">
                      <ProductImage product={product} catName={catNameById.get(product.category_id) ?? ""} size="full" />
                      {qty > 0 && (
                        <span className="animate-bounce-in absolute left-2 top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-saffron px-1 text-3xs font-bold text-white shadow-warm num">
                          {faNum(qty)}
                        </span>
                      )}
                    </div>
                    {/* اطلاعات */}
                    <div className="flex flex-1 flex-col p-2.5 text-center">
                      <p className="line-clamp-2 text-2xs font-bold leading-tight text-ink">
                        {product.name}
                      </p>
                      <p className="mt-1 text-2xs font-black text-saffron-dark num">
                        {formatToman(product.price)}
                      </p>
                      <button type="button"
                        aria-label={`افزودن ${product.name} به سبد`}
                        onClick={() => setQty(product.id, qty + 1)}
                        className="gradient-saffron mx-auto mt-2 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white shadow-warm transition-all active:scale-90">
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
            aria-label={cat.name}
            className={`animate-fade-in-up stagger-${Math.min(catIdx + 1, 6)} scroll-mt-24`}>

            {/* عنوان دسته */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-saffron-100 to-saffron/25 text-xl shadow-soft">
                <span aria-hidden="true">{categoryEmoji(cat.name)}</span>
              </div>
              <div className="flex-1">
                <h2 className="font-display text-xl leading-tight text-ink">{cat.name}</h2>
                <p className="text-2xs text-ink-muted">{faNum(cat.products.length)} آیتم</p>
              </div>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-saffron/25" aria-hidden="true" />
            </div>

            {/* نمایش کارتی یا لیستی بر اساس وجود تصویر */}
            {cat.products.some((p) => p.image_url) ? (
              <div className="grid grid-cols-2 gap-3">
                {cat.products.map((product) => (
                  <GridCard key={product.id} product={product} catName={cat.name}
                    qty={cart[product.id] ?? 0}
                    onQtyChange={setQty} />
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {cat.products.map((product) => (
                  <ListCard key={product.id} product={product} catName={cat.name}
                    qty={cart[product.id] ?? 0}
                    onQtyChange={setQty} />
                ))}
              </div>
            )}
          </section>
        ))}
      </main>

      {/* ══ نوار سبد خرید ════════════════════════════════════════════════════ */}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg transition-all duration-500 ease-out-quint ${
          cartCount > 0 ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="gradient-dark mx-3 mb-3 overflow-hidden rounded-2xl shadow-elevated">
          <button type="button" onClick={() => setCheckoutOpen(true)}
            className="flex w-full items-center justify-between px-5 py-4 transition-all active:scale-[0.98]">
            <div className="flex items-center gap-3 text-white">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-saffron/20 text-lg" aria-hidden="true">
                🧇
              </div>
              <div className="text-right">
                <p className="text-2xs text-white/50">سبد خرید</p>
                <p className="text-sm font-black num">{formatToman(cartTotal)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span aria-label={`${faNum(cartCount)} قلم`}
                className="flex h-7 min-w-[28px] animate-pulse-glow items-center justify-center rounded-full bg-saffron px-2 text-2xs font-bold text-white num">
                {faNum(cartCount)}
              </span>
              <span className="gradient-saffron rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-warm transition-all">
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
          <div role="dialog" aria-modal="true" aria-label="تکمیل سفارش"
            className="max-h-[92vh] w-full max-w-lg animate-fade-in-up overflow-y-auto rounded-t-3xl bg-white shadow-elevated"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={(e) => e.stopPropagation()}>

            {/* دستگیره */}
            <div className="flex justify-center pb-1 pt-3">
              <div className="h-1.5 w-12 rounded-full bg-cream-300" aria-hidden="true" />
            </div>

            {/* هدر */}
            <div className="gradient-saffron mx-5 mt-2 flex items-center gap-3 rounded-2xl px-4 py-3.5">
              <span className="text-2xl" aria-hidden="true">🛒</span>
              <div>
                <p className="font-display text-lg leading-tight text-white">سفارش شما</p>
                <p className="text-2xs text-white/70">کافه‌بستنی تی‌تی</p>
              </div>
            </div>

            <div className="px-5 pb-6 pt-5">
              {/* آیتم‌ها */}
              <ul className="space-y-3">
                {cartLines.map((line) => (
                  <li key={line.product.id}
                    className="animate-slide-in-right flex items-center justify-between gap-3 rounded-xl bg-cream-100 p-3 text-sm">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-xl shadow-soft">
                        <ProductImage product={line.product}
                          catName={catNameById.get(line.product.category_id) ?? ""}
                          size="thumb" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-ink">{line.product.name}</p>
                        <p className="text-2xs text-ink-muted num">{formatToman(line.product.price)}</p>
                      </div>
                    </div>
                    <QtyControl value={line.quantity} onChange={(q) => setQty(line.product.id, q)} disabled={submitting} compact />
                    <span className="w-20 flex-shrink-0 text-left text-sm font-black text-saffron-dark num">
                      {formatToman(line.product.price * line.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="receipt-divider my-5" />

              {/* جمع کل */}
              <div className="flex items-center justify-between rounded-xl bg-saffron-50 px-4 py-3">
                <span className="font-bold text-ink">جمع کل</span>
                <span className="text-lg font-black text-saffron-dark num">{formatToman(cartTotal)}</span>
              </div>
              <p className="mt-2 text-center text-2xs text-ink-muted">💳 پرداخت حضوری داخل کافه انجام می‌شود</p>

              {/* فرم اطلاعات */}
              <div className="mt-5 space-y-3">
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true">👤</span>
                  <input type="text" value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="اسم شما (اختیاری — برای صدا زدن)"
                    aria-label="اسم شما"
                    maxLength={100} disabled={submitting}
                    className="w-full rounded-xl border border-saffron/20 bg-cream-50 p-3 pr-10 text-sm outline-none transition-all focus:border-saffron focus:shadow-warm disabled:opacity-50" />
                </div>
                <div className="relative">
                  <span className="absolute right-3 top-3 text-ink-faint" aria-hidden="true">📝</span>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="توضیحات (اختیاری — مثلاً: بدون شکر)"
                    aria-label="توضیحات سفارش"
                    maxLength={500} rows={2} disabled={submitting}
                    className="w-full resize-none rounded-xl border border-saffron/20 bg-cream-50 p-3 pr-10 text-sm outline-none transition-all focus:border-saffron focus:shadow-warm disabled:opacity-50" />
                </div>
              </div>

              {/* خطا */}
              {submitError && (
                <div className="animate-fade-in-up mt-4 flex items-start gap-2 rounded-xl bg-berry-light p-3 text-sm text-berry" role="alert">
                  <span aria-hidden="true">⚠️</span><span className="font-medium">{submitError}</span>
                </div>
              )}

              {/* دکمه‌ها */}
              <div className="mt-5 flex gap-3">
                <button type="button" disabled={submitting} onClick={submitOrder}
                  className="gradient-saffron flex-1 rounded-xl px-4 py-3.5 font-bold text-white shadow-warm transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50">
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      در حال ثبت…
                    </span>
                  ) : "ثبت نهایی سفارش"}
                </button>
                <button type="button" disabled={submitting} onClick={() => setCheckoutOpen(false)}
                  className="rounded-xl border-2 border-saffron/20 px-5 py-3.5 text-sm font-bold text-ink transition-all hover:bg-saffron-100 active:scale-[0.98]">
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
const GridCard = memo(function GridCard({ product, catName, qty, onQtyChange }: {
  product: Product; catName: string; qty: number; onQtyChange: (productId: number, qty: number) => void;
}) {
  const inCart = qty > 0;
  const unavailable = !product.is_available;
  return (
    <div className={`group animate-fade-in-up relative overflow-hidden rounded-2xl bg-white shadow-card transition-all duration-300 ease-out-quint hover-lift ${
      inCart ? "ring-2 ring-saffron shadow-warm" : ""
    } ${unavailable ? "opacity-40 grayscale" : ""}`}>
      {/* تصویر */}
      <div className="relative h-36 w-full overflow-hidden rounded-t-2xl">
        <ProductImage product={product} catName={catName} size="full" />
        {/* بج ناموجود */}
        {unavailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/40">
            <span className="rounded-lg bg-berry px-3 py-1.5 text-2xs font-bold text-white shadow-lg">
              ناموجود
            </span>
          </div>
        )}
        {/* بج تعداد */}
        {inCart && (
          <span className="animate-bounce-in absolute left-2 top-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-saffron px-1.5 text-2xs font-bold text-white shadow-warm num">
            {faNum(qty)}
          </span>
        )}
      </div>
      {/* اطلاعات */}
      <div className="p-3">
        <p className="line-clamp-1 text-sm font-bold leading-snug text-ink">{product.name}</p>
        {product.description && (
          <p className="mt-0.5 line-clamp-1 text-2xs text-ink-muted">{product.description}</p>
        )}
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-sm font-black text-saffron-dark num">
            {formatToman(product.price)}
          </span>
          <QtyControl value={qty} onChange={(q) => onQtyChange(product.id, q)} disabled={unavailable} compact />
        </div>
      </div>
    </div>
  );
});

// ═══ کارت لیستی (بدون تصویر) ═══════════════════════════════════════════════
const ListCard = memo(function ListCard({ product, catName, qty, onQtyChange }: {
  product: Product; catName: string; qty: number; onQtyChange: (productId: number, qty: number) => void;
}) {
  const inCart = qty > 0;
  const unavailable = !product.is_available;
  return (
    <div className={`group animate-fade-in-up relative flex items-center gap-4 rounded-2xl bg-white p-4 shadow-card transition-all duration-300 ease-out-quint hover-lift ${
      inCart ? "bg-saffron-50 shadow-warm ring-1 ring-saffron/30" : ""
    } ${unavailable ? "opacity-40 grayscale" : ""}`}>
      {/* تصویر / ایموجی */}
      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl shadow-soft">
        <ProductImage product={product} catName={catName} size="full" />
      </div>
      {/* اطلاعات */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-bold text-ink">{product.name}</p>
          {unavailable && (
            <span className="rounded-md bg-berry px-1.5 py-0.5 text-3xs font-bold text-white">ناموجود</span>
          )}
        </div>
        {product.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">{product.description}</p>
        )}
      </div>
      {/* قیمت و کنترل */}
      <div className="flex flex-shrink-0 items-center gap-3">
        <span className="whitespace-nowrap text-sm font-black text-saffron-dark num">
          {formatToman(product.price)}
        </span>
        <QtyControl value={qty} onChange={(q) => onQtyChange(product.id, q)} disabled={unavailable} />
      </div>
    </div>
  );
});
