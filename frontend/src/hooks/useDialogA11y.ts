import { useEffect, useRef, type RefObject } from "react";

// المان‌های قابل فوکوس داخل دیالوگ (برای تلهٔ Tab و فوکوس اولیه)
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * دسترس‌پذیری دیالوگ‌ها (مودال):
 * - هنگام باز شدن: فوکوس اولین المان قابل فوکوس (یا خود دیالوگ با tabindex="-1")
 * - تلهٔ Tab / Shift+Tab تا فوکوس از دیالوگ بیرون نرود
 * - قفل اسکرول بدنه و بازگرداندن حالت قبل هنگام بستن
 * - بازگرداندن فوکوس به المانی که قبل از باز شدن فعال بود
 * - بستن با Escape
 */
// enabled: وقتی دیالوگ بسته است (مثلاً شیت چک‌اوت داخل صفحه) هیچ رفتاری اجرا نشود
export function useDialogA11y(
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  enabled = true,
) {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const dialog = dialogRef.current;
    // فوکوس اولین المان قابل فوکوس؛ اگر المانی نبود، خود دیالوگ فوکوس می‌گیرد
    const firstFocusable = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? dialog)?.focus();

    // قفل اسکرول بدنه تا پس‌زمینه اسکرول نشود
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;

      // فقط المان‌های واقعاً قابل‌مشاهده داخل تله می‌مانند
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.getClientRects().length > 0
      );
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && dialog.contains(active);

      if (e.shiftKey) {
        // Shift+Tab از اولین المان (یا بیرون از دیالوگ) → آخرین المان
        if (!inside || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        // Tab از آخرین المان (یا بیرون از دیالوگ) → اولین المان
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      // بازگرداندن فوکوس به المان قبلی (اگر هنوز در DOM هست)
      const prev = previouslyFocused.current;
      if (prev && document.contains(prev)) prev.focus();
    };
  }, [dialogRef, onClose, enabled]);
}
