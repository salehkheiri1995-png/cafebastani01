import type { OrderStatus } from "../types";

// برچسب رنگی وضعیت سفارش
const LABELS: Record<OrderStatus, string> = {
  pending: "در انتظار",
  preparing: "در حال آماده‌سازی",
  ready: "آماده تحویل",
  completed: "تحویل شد",
  cancelled: "لغو شد",
};

const STYLES: Record<OrderStatus, string> = {
  pending: "bg-saffron-light text-saffron-dark",
  preparing: "bg-blue-100 text-blue-800",
  ready: "bg-pistachio-light text-pistachio",
  completed: "bg-gray-200 text-gray-600",
  cancelled: "bg-berry-light text-berry",
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
