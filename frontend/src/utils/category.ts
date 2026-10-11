// تشخیص emoji و گرادینت هر دسته بر اساس نام آن
// مشترک بین منوی مشتری و انتخاب محصول در سفارش دستی صندوق

export function categoryEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("بستنی") || n.includes("آیس") || n.includes("ice")) return "🍨";
  if (n.includes("قهوه") || n.includes("کافه") || n.includes("coffee")) return "☕";
  if (n.includes("آبمیوه") || n.includes("آب‌میوه") || n.includes("juice")) return "🧃";
  if (n.includes("کیک") || n.includes("شیرینی")) return "🎂";
  if (n.includes("چای") || n.includes("دمنوش")) return "🍵";
  if (n.includes("میلک") || n.includes("شیک")) return "🥤";
  if (n.includes("وافل") || n.includes("کرپ")) return "🧇";
  if (n.includes("اسموتی") || n.includes("فراپه")) return "🥛";
  if (n.includes("نوشیدنی") || n.includes("ساندویچ") || n.includes("غذا")) return "🥪";
  return "🍦";
}

export function categoryGradient(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("بستنی") || n.includes("آیس")) return "from-rose-100 via-orange-50 to-amber-50";
  if (n.includes("قهوه") || n.includes("کافه")) return "from-amber-100 via-orange-50 to-yellow-50";
  if (n.includes("آبمیوه") || n.includes("نوشیدنی")) return "from-emerald-100 via-green-50 to-teal-50";
  if (n.includes("کیک") || n.includes("شیرینی")) return "from-violet-100 via-fuchsia-50 to-rose-50";
  if (n.includes("میلک") || n.includes("شیک") || n.includes("اسموتی")) return "from-sky-100 via-cyan-50 to-blue-50";
  return "from-saffron-100 via-cream-200 to-white";
}
