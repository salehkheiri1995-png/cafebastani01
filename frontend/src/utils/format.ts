// قالب‌بندی اعداد، قیمت و زمان به فارسی

export function faNum(n: number): string {
  return n.toLocaleString("fa-IR");
}

export function formatToman(n: number): string {
  return `${faNum(n)} تومان`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
