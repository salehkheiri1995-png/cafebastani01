import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { MenuCategory } from "../types";
import { formatToman } from "../utils/format";

interface Props {
  onClose: () => void;
}

// پیش‌نمایش منوی مشتری — فقط خواندنی، بدون سبد خرید
export default function MenuPreviewModal({ onClose }: Props) {
  const [menu, setMenu] = useState<MenuCategory[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activecat, setActiveCat] = useState<number | "all">("all");
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});
  const overlayRef = useRef<HTMLDivElement>(null);

  const loadMenu = useCallback(async () => {
    try {
      const data = await api.get<MenuCategory[]>("/api/menu");
      setMenu(data);
      setLoadError(null);
    } catch {
      setLoadError("خطا در دریافت منو");
    }
  }, []);

  useEffect(() => {
    loadMenu();
    // بستن با Escape
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loadMenu, onClose]);

  const scrollTo = (catId: number) => {
    setActiveCat(catId);
    sectionRefs.current[catId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const visibleCategories =
    activecat === "all"
      ? menu ?? []
      : (menu ?? []).filter((c) => c.id === activecat);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-cream sm:rounded-2xl">
        {/* هدر مودال */}
        <div className="flex items-center justify-between border-b border-saffron/20 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍨</span>
            <span className="font-extrabold">پیش‌نمایش منوی مشتری</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-ink/60 hover:bg-saffron-light"
            aria-label="بستن"
          >
            ✕
          </button>
        </div>

        {/* تب‌های دسته — sticky */}
        {menu && menu.length > 0 && (
          <nav className="no-scrollbar flex gap-2 overflow-x-auto bg-white/90 px-4 py-2.5 backdrop-blur">
            <button
              type="button"
              onClick={() => setActiveCat("all")}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                activecat === "all" ? "bg-ink text-white" : "border border-saffron/30 bg-white hover:bg-saffron-light"
              }`}
            >
              همه
            </button>
            {menu.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => scrollTo(cat.id)}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                  activecat === cat.id ? "bg-ink text-white" : "border border-saffron/30 bg-white hover:bg-saffron-light"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </nav>
        )}

        {/* بدنه */}
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-3">
          {loadError && (
            <div className="rounded-xl bg-berry-light p-3 text-sm text-berry">
              {loadError}
              <button type="button" onClick={loadMenu} className="mr-2 font-bold underline">تلاش دوباره</button>
            </div>
          )}

          {!menu && !loadError && (
            <p className="py-10 text-center text-sm text-ink/40">در حال دریافت منو…</p>
          )}

          {menu?.length === 0 && (
            <p className="py-10 text-center text-sm text-ink/40">فعلاً چیزی در منو نیست</p>
          )}

          {visibleCategories.map((cat) => (
            <section
              key={cat.id}
              ref={(el) => { sectionRefs.current[cat.id] = el; }}
              className="scroll-mt-12"
            >
              <h2 className="mb-2 text-sm font-extrabold text-ink/70">{cat.name}</h2>
              <div className="space-y-2">
                {cat.products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-start justify-between gap-3 rounded-xl bg-white p-3 shadow-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-bold">{product.name}</div>
                      {product.description && (
                        <div className="mt-0.5 line-clamp-2 text-xs text-ink/50">{product.description}</div>
                      )}
                    </div>
                    <div className="shrink-0 rounded-full bg-saffron-light px-2.5 py-1 text-xs font-bold text-saffron-dark">
                      {formatToman(product.price)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* فوتر */}
        <div className="border-t border-saffron/20 bg-white px-4 py-3 text-center text-xs text-ink/40">
          این نمایش فقط خواندنی است — برای سفارش از تب «سفارش دستی» استفاده کنید
        </div>
      </div>
    </div>
  );
}
