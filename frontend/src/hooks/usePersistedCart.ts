import { useCallback, useEffect, useState } from "react";

// کلید ذخیره‌سازی سبد خرید + اطلاعات مشتری در localStorage
const STORAGE_KEY = "cafe_cart_v1";

/** چیزی که بین رفرش‌ها نگه داشته می‌شود */
interface CartDraft {
  cart: Record<number, number>;
  customerName: string;
  note: string;
}

/** هر بار آبجکت تازه برمی‌گرداند تا اشتراک مرجع cart بین state ها باعث باگ نشود */
function emptyDraft(): CartDraft {
  return { cart: {}, customerName: "", note: "" };
}

/** خواندن امن از localStorage — داده خراب یا حالت خصوصی مرورگر ⇒ مقادیر پیش‌فرض */
function readDraft(): CartDraft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDraft();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return emptyDraft();
    const data = parsed as Partial<CartDraft>;

    // فقط تعداد صحیح مثبت برای شناسه‌های عددی معتبر است (محافظت در برابر داده دستکاری‌شده)
    const cart: Record<number, number> = {};
    if (typeof data.cart === "object" && data.cart !== null) {
      for (const [id, qty] of Object.entries(data.cart as Record<string, unknown>)) {
        const productId = Number(id);
        const quantity = Number(qty);
        if (Number.isInteger(productId) && productId > 0 && Number.isInteger(quantity) && quantity > 0) {
          cart[productId] = quantity;
        }
      }
    }
    return {
      cart,
      customerName: typeof data.customerName === "string" ? data.customerName : "",
      note: typeof data.note === "string" ? data.note : "",
    };
  } catch {
    return emptyDraft();
  }
}

/**
 * سبد خرید ماندگار: سبد + اسم/توضیح مشتری از localStorage لود می‌شود،
 * با هر تغییر نوشته می‌شود و با ثبت موفق سفارش پاک می‌شود (clearCart).
 */
export function usePersistedCart() {
  const [draft, setDraft] = useState<CartDraft>(readDraft);

  // نوشتن در localStorage هر بار که سبد یا اطلاعات مشتری عوض می‌شود
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* حافظه پر است یا localStorage در دسترس نیست — بی‌صدا رد می‌شویم */
    }
  }, [draft]);

  // امضای setter سازگار با setCart((prev) => ...) در منو
  const setCart = useCallback(
    (updater: (prev: Record<number, number>) => Record<number, number>) =>
      setDraft((prev) => ({ ...prev, cart: updater(prev.cart) })),
    [],
  );
  const setCustomerName = useCallback(
    (value: string) => setDraft((prev) => ({ ...prev, customerName: value })),
    [],
  );
  const setNote = useCallback((value: string) => setDraft((prev) => ({ ...prev, note: value })), []);

  /** پس از ثبت موفق سفارش: سبد و اطلاعات مشتری برای خرید بعدی پاک می‌شود */
  const clearCart = useCallback(() => setDraft(emptyDraft()), []);

  return {
    cart: draft.cart,
    customerName: draft.customerName,
    note: draft.note,
    setCart,
    setCustomerName,
    setNote,
    clearCart,
  };
}
