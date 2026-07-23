// هلپر آدرس عکس: تبدیل آدرس نسبی بک‌اند (/static/...) به آدرس قابل استفاده در فرانت
//
// - در حالت توسعه، Vite مسیر /static را (مثل /api) به بک‌اند پراکسی می‌کند،
//   پس آدرس نسبی همان‌طور کار می‌کند.
// - اگر فرانت جدا از بک‌اند سرو شود، کافی است VITE_API_URL را در .env فرانت
//   ست کنید (مثل http://localhost:8000) تا آدرس‌ها کامل شوند.

const rawBase: unknown = import.meta.env.VITE_API_URL;
const API_BASE: string =
  typeof rawBase === "string" ? rawBase.replace(/\/+$/, "") : "";

export function resolveImageUrl(
  imageUrl: string | null | undefined,
): string | null {
  if (!imageUrl) return null;
  // آدرس‌های کامل یا data URI دست نمی‌خورند
  if (/^(https?:)?\/\//.test(imageUrl) || imageUrl.startsWith("data:")) {
    return imageUrl;
  }
  return `${API_BASE}${imageUrl}`;
}
