import type { Order, OrderStatus } from "../types";
import { faNum, formatTime, formatToman } from "../utils/format";
import StatusBadge from "./StatusBadge";

interface Props {
  order: Order;
  // اگر پاس داده شود، دکمه‌های تغییر وضعیت نمایش داده می‌شوند (پنل صندوق)
  onStatusChange?: (orderId: number, status: OrderStatus) => void;
  busy?: boolean;
}

// دکمه‌های مجاز برای هر وضعیت — هم‌راستا با ALLOWED_TRANSITIONS بک‌اند
const ACTIONS: Partial<
  Record<OrderStatus, { label: string; next: OrderStatus; style: string }[]>
> = {
  pending: [
    { label: "شروع آماده‌سازی", next: "preparing", style: "bg-blue-600 text-white" },
    { label: "لغو سفارش", next: "cancelled", style: "bg-berry-light text-berry" },
  ],
  preparing: [
    { label: "آماده شد", next: "ready", style: "bg-pistachio text-white" },
    { label: "لغو سفارش", next: "cancelled", style: "bg-berry-light text-berry" },
  ],
  ready: [
    { label: "تحویل و تسویه شد", next: "completed", style: "bg-ink text-white" },
  ],
};

// کارت کامل سفارش به سبک رسید — اقلام، جمع کل و اطلاعات مشتری
export default function OrderCard({ order, onStatusChange, busy }: Props) {
  const actions = onStatusChange ? ACTIONS[order.status] ?? [] : [];

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      {/* سربرگ رسید */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="font-mono text-lg font-bold tracking-widest" dir="ltr">
            {order.code}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {formatTime(order.created_at)} —{" "}
            {order.source === "online" ? "سفارش آنلاین" : "سفارش حضوری"}
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {order.customer_name && (
        <div className="mb-1 text-sm">
          <span className="text-gray-500">مشتری: </span>
          <span className="font-bold">{order.customer_name}</span>
        </div>
      )}
      {order.note && (
        <div className="mb-2 rounded-lg bg-cream p-2 text-sm">
          <span className="text-gray-500">توضیحات: </span>
          {order.note}
        </div>
      )}

      {/* اقلام */}
      <div className="receipt-divider my-3" />
      <ul className="space-y-2">
        {order.items.map((item, i) => (
          <li key={i} className="flex items-baseline justify-between gap-2 text-sm">
            <span>
              {item.product_name}
              <span className="text-gray-500"> × {faNum(item.quantity)}</span>
            </span>
            <span className="whitespace-nowrap font-medium">
              {formatToman(item.unit_price * item.quantity)}
            </span>
          </li>
        ))}
      </ul>
      <div className="receipt-divider my-3" />

      {/* جمع کل */}
      <div className="flex items-center justify-between text-base font-bold">
        <span>جمع کل</span>
        <span className="text-saffron-dark">{formatToman(order.total_amount)}</span>
      </div>

      {/* دکمه‌های تغییر وضعیت (فقط پنل صندوق) */}
      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.next}
              type="button"
              disabled={busy}
              onClick={() => onStatusChange?.(order.id, action.next)}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-opacity disabled:opacity-50 ${action.style}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
