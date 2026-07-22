import { useState } from "react";
import type { MenuCategory } from "../types";
import { formatToman } from "../utils/format";
import { faNum } from "../utils/format";

type ViewMode = "grid" | "list";

const STORAGE_KEY = "walkin_view_mode";

function getStoredMode(): ViewMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "grid" || v === "list") return v;
  } catch {
    // ignore
  }
  return "grid";
}

interface Props {
  menu: MenuCategory[];
  cart: Record<number, number>;
  onQtyChange: (productId: number, qty: number) => void;
  onRefresh: () => void;
}

// کامپوننت انتخاب محصول برای سفارش دستی — grid کارتی یا لیست
export default function WalkInMenuGrid({ menu, cart, onQtyChange, onRefresh }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredMode);
  const [activeCat, setActiveCat] = useState<number | "all">("all");

  const setMode = (m: ViewMode) => {
    setViewMode(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch { /* ignore */ }
  };

  const visibleProducts =
    activeCat === "all"
      ? menu.flatMap((c) => c.products)
      : (menu.find((c) => c.id === activeCat)?.products ?? []);

  // emoji پیشفرض بر اساس نام دسته
  const catEmoji = (catName: string): string => {
    const n = catName.toLowerCase();
    if (n.includes("بستنی")) return "🍨";
    if (n.includes("قهوه") || n.includes("کافه")) return "☕";
    if (n.includes("آبمیوه") || n.includes("نوشیدنی")) return "🥤";
    if (n.includes("کیک") || n.includes("شیرینی")) return "🍰";
    if (n.includes("ساندویچ") || n.includes("غذا")) return "🥪";
    return "🍨";
  };

  const catName = (catId: number) =>
    menu.find((c) => c.id === catId)?.name ?? "";

  return (
    <div>
      {/* نوار بالا: تازه‌سازی + سوئیچ نمایش */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">انتخاب از منو</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs font-bold text-saffron-dark underline"
          >
            تازه‌سازی
          </button>
          <div className="flex overflow-hidden rounded-lg border border-saffron/30">
            <button
              type="button"
              title="نمایش کارتی"
              onClick={() => setMode("grid")}
              className={`px-2.5 py-1.5 text-sm transition-colors ${
                viewMode === "grid" ? "bg-ink text-white" : "bg-white hover:bg-saffron-light"
              }`}
            >
              ⊞
            </button>
            <button
              type="button"
              title="نمایش لیستی"
              onClick={() => setMode("list")}
              className={`border-r border-saffron/30 px-2.5 py-1.5 text-sm transition-colors ${
                viewMode === "list" ? "bg-ink text-white" : "bg-white hover:bg-saffron-light"
              }`}
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* تب‌های دسته */}
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveCat("all")}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
            activeCat === "all" ? "bg-ink text-white" : "bg-white hover:bg-saffron-light"
          }`}
        >
          همه
        </button>
        {menu.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCat(cat.id)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              activeCat === cat.id ? "bg-ink text-white" : "bg-white hover:bg-saffron-light"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* محصولات */}
      <div className="max-h-[28rem] overflow-y-auto pl-1">
        {viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {visibleProducts.map((product) => {
              const qty = cart[product.id] ?? 0;
              const emoji = catEmoji(catName(product.category_id));
              return (
                <div
                  key={product.id}
                  className={`flex min-h-[110px] flex-col justify-between rounded-xl border p-2.5 transition-all duration-150 ${
                    qty > 0
                      ? "border-saffron bg-saffron/10"
                      : "border-transparent bg-white hover:bg-saffron-light"
                  }`}
                >
                  {/* بالا: emoji + نام + قیمت */}
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => qty === 0 && onQtyChange(product.id, 1)}
                  >
                    <div className="text-xl">{emoji}</div>
                    <div className="mt-1 line-clamp-2 text-xs font-bold leading-tight">
                      {product.name}
                    </div>
                    <div className="mt-0.5 text-xs text-saffron-dark">
                      {formatToman(product.price)}
                    </div>
                  </div>

                  {/* پایین: counter یا دکمه + */}
                  <div className="mt-2">
                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => onQtyChange(product.id, 1)}
                        className="w-full rounded-lg bg-saffron py-1 text-sm font-bold text-white hover:bg-saffron-dark"
                      >
                        +
                      </button>
                    ) : (
                      <div className="flex items-center justify-between rounded-lg bg-white px-1">
                        <button
                          type="button"
                          onClick={() => onQtyChange(product.id, qty - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-lg font-bold text-ink hover:bg-berry-light hover:text-berry"
                        >
                          −
                        </button>
                        <span className="text-sm font-bold">{faNum(qty)}</span>
                        <button
                          type="button"
                          onClick={() => onQtyChange(product.id, qty + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-lg font-bold text-ink hover:bg-saffron-light hover:text-saffron-dark"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // حالت لیستی
          <div className="space-y-2">
            {visibleProducts.map((product) => {
              const qty = cart[product.id] ?? 0;
              return (
                <div
                  key={product.id}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition-colors ${
                    qty > 0 ? "border-saffron bg-saffron/10" : "border-transparent bg-cream"
                  }`}
                >
                  <div className="min-w-0 text-sm">
                    <span className="font-medium">{product.name}</span>
                    <span className="mr-2 text-xs text-saffron-dark">
                      {formatToman(product.price)}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {qty > 0 && (
                      <button
                        type="button"
                        onClick={() => onQtyChange(product.id, qty - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-base font-bold hover:bg-berry-light hover:text-berry"
                      >
                        −
                      </button>
                    )}
                    {qty > 0 && (
                      <span className="w-5 text-center text-sm font-bold">{faNum(qty)}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onQtyChange(product.id, qty + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-saffron text-base font-bold text-white hover:bg-saffron-dark"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {visibleProducts.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40">محصولی در این دسته موجود نیست</p>
        )}
      </div>
    </div>
  );
}
