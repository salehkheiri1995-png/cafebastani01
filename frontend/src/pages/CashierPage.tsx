import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, clearToken } from "../api/client";
import OrderCard from "../components/OrderCard";
import PanelHeader from "../components/PanelHeader";
import QrScanner from "../components/QrScanner";
import StatusBadge from "../components/StatusBadge";
import WalkInMenuGrid from "../components/WalkInMenuGrid";
import type { MenuCategory, Order, OrderItem, OrderStatus, Product } from "../types";
import { faNum, formatTime, formatToman } from "../utils/format";

type Tab = "scan" | "walkin" | "today";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "scan", label: "اسکن QR", icon: "📷" },
  { id: "walkin", label: "سفارش دستی", icon: "✍️" },
  { id: "today", label: "سفارش‌های امروز", icon: "📋" },
];

const FILTERS: { id: OrderStatus | "all"; label: string; color: string }[] = [
  { id: "all", label: "همه", color: "#6b7280" },
  { id: "pending", label: "در انتظار", color: "#B8791A" },
  { id: "preparing", label: "در حال آماده‌سازی", color: "#2F7D5D" },
  { id: "ready", label: "آماده تحویل", color: "#1d4ed8" },
  { id: "completed", label: "تحویل‌شده", color: "#4b5563" },
  { id: "cancelled", label: "لغوشده", color: "#B3323B" },
];

const EDITABLE_STATUSES: OrderStatus[] = ["pending", "preparing"];

// ───────────────────────── تابع پرینت رسید حرارتی ─────────────────────────
function printReceipt(order: Order) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("fa-IR", {
    year: "numeric", month: "long", day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("fa-IR", {
    hour: "2-digit", minute: "2-digit",
  });

  const itemsHtml = order.items
    .map(
      (item: OrderItem) => `
      <tr>
        <td style="padding:3px 0;text-align:right;">${item.product_name}</td>
        <td style="padding:3px 4px;text-align:center;">${faNum(item.quantity)}</td>
        <td style="padding:3px 0;text-align:left;direction:ltr;">${formatToman(item.unit_price)}</td>
      </tr>
      <tr>
        <td colspan="3" style="padding:0 0 4px 0;text-align:left;direction:ltr;font-size:10px;color:#888;">
          جمع: ${formatToman(item.unit_price * item.quantity)}
        </td>
      </tr>`
    )
    .join("");

  const receiptHtml = `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <title>رسید سفارش ${order.code}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Vazirmatn', Tahoma, Arial, sans-serif;
      font-size: 12px;
      width: 80mm;
      max-width: 80mm;
      padding: 8px 10px;
      color: #111;
      background: white;
    }
    .center { text-align: center; }
    .cafe-name {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }
    .divider {
      border: none;
      border-top: 1px dashed #555;
      margin: 6px 0;
    }
    .divider-solid {
      border: none;
      border-top: 2px solid #111;
      margin: 6px 0;
    }
    .label { color: #555; font-size: 10px; }
    .code {
      font-family: monospace;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 2px;
      direction: ltr;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    th {
      font-size: 10px;
      color: #555;
      padding: 2px 0;
      font-weight: 700;
    }
    .total-row td {
      font-size: 14px;
      font-weight: 900;
      padding-top: 4px;
    }
    .total-amount {
      font-size: 16px;
      font-weight: 900;
      direction: ltr;
    }
    .footer {
      font-size: 10px;
      color: #666;
      margin-top: 4px;
    }
    @media print {
      body { width: 80mm; }
      @page { margin: 0; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <div class="center">
    <div class="cafe-name">☕ کافه بستنی</div>
    <div class="label">رسید سفارش</div>
  </div>
  <hr class="divider-solid"/>

  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
    <span class="label">کد سفارش:</span>
    <span class="code">${order.code}</span>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
    <span class="label">تاریخ:</span>
    <span>${dateStr}</span>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
    <span class="label">ساعت:</span>
    <span>${timeStr}</span>
  </div>
  ${order.customer_name ? `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
    <span class="label">مشتری:</span>
    <span>${order.customer_name}</span>
  </div>` : ""}

  ${order.queue_number ? `
  <div style="text-align:center;margin:8px 0;padding:8px;
    background:linear-gradient(135deg,#E9A13B,#B8791A);
    border-radius:8px;">
    <div style="font-size:10px;color:rgba(255,255,255,0.8);">شماره نوبت</div>
    <div style="font-size:28px;font-weight:900;color:white;
      direction:rtl;">${faNum(order.queue_number)}</div>
  </div>` : ""}

  <hr class="divider"/>

  <table>
    <thead>
      <tr>
        <th style="text-align:right;">نام</th>
        <th style="text-align:center;">تعداد</th>
        <th style="text-align:left;direction:ltr;">قیمت</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <hr class="divider-solid"/>

  <table>
    <tr class="total-row">
      <td style="text-align:right;">جمع کل:</td>
      <td style="text-align:left;direction:ltr;" class="total-amount">${formatToman(order.total_amount)}</td>
    </tr>
  </table>

  <hr class="divider"/>

  <div class="center footer">
    <div>با تشکر از انتخاب شما 🙏</div>
    <div style="margin-top:2px;">کافه بستنی — پرداخت انجام شد ✓</div>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) { alert("مرورگر پاپ‌آپ را مسدود کرده. لطفاً مجوز پاپ‌آپ را بده."); return; }
  win.document.write(receiptHtml);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 500);
}

// ───────────────────────────── مودال ویرایش سفارش ─────────────────────────────
interface EditOrderModalProps {
  order: Order;
  menu: MenuCategory[];
  onClose: () => void;
  onSaved: (updated: Order) => void;
}

function EditOrderModal({ order, menu, onClose, onSaved }: EditOrderModalProps) {
  const initialCart = useMemo(() => {
    const m: Record<number, number> = {};
    order.items.forEach((it) => { m[it.product_id] = it.quantity; });
    return m;
  }, [order]);

  const [cart, setCart] = useState<Record<number, number>>(initialCart);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const allProducts = useMemo(() => menu.flatMap((c) => c.products), [menu]);

  const setQty = (productId: number, qty: number) => {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  };

  const lines = useMemo(() =>
    allProducts
      .filter((p) => (cart[p.id] ?? 0) > 0)
      .map((p) => ({ product: p, quantity: cart[p.id] })),
    [allProducts, cart]
  );

  const newTotal = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);

  const save = async () => {
    if (lines.length === 0) { setErr("حداقل یک آیتم باید در سفارش باشد"); return; }
    setBusy(true); setErr(null);
    try {
      const updated = await api.patch<Order>(`/api/cashier/orders/${order.id}/items`, {
        items: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
      });
      onSaved(updated);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "خطای غیرمنتظره");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-t-3xl sm:rounded-3xl bg-white overflow-hidden flex flex-col"
        style={{ maxHeight: "92vh", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#f0ebe3" }}>
          <div>
            <h2 className="font-bold text-base" style={{ color: "#33261D" }}>ویرایش سفارش</h2>
            <p className="text-xs mt-0.5 font-mono" style={{ color: "#B8791A" }} dir="ltr">{order.code}</p>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
            style={{ background: "#f7f3ee", color: "#33261D" }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid md:grid-cols-2 gap-0">
            <div className="border-l" style={{ borderColor: "#f0ebe3" }}>
              <div className="px-4 py-3 text-xs font-bold" style={{ color: "rgba(51,38,29,0.45)", background: "#faf6ef" }}>
                انتخاب از منو
              </div>
              {menu.filter((cat) => cat.products.some((p) => p.is_available)).map((cat) => (
                <div key={cat.id}>
                  <div className="px-4 py-2 text-xs font-bold sticky top-0" style={{ background: "#fff8f0", color: "#B8791A" }}>
                    {cat.name}
                  </div>
                  {cat.products.filter((p) => p.is_available).map((p) => {
                    const qty = cart[p.id] ?? 0;
                    return (
                      <div key={p.id} className="flex items-center justify-between px-4 py-2.5 border-b"
                        style={{ borderColor: "#faf6ef" }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "#33261D" }}>{p.name}</p>
                          <p className="text-xs" style={{ color: "#B8791A" }}>{formatToman(p.price)}</p>
                        </div>
                        <div className="flex items-center gap-1 mr-2">
                          <button type="button" onClick={() => setQty(p.id, qty - 1)}
                            className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-base transition-all"
                            style={qty > 0
                              ? { background: "#fee2e2", color: "#991b1b" }
                              : { background: "#f3f4f6", color: "#9ca3af" }}>−</button>
                          <span className="w-6 text-center text-sm font-bold" style={{ color: "#33261D" }}>
                            {qty > 0 ? faNum(qty) : ""}
                          </span>
                          <button type="button" onClick={() => setQty(p.id, qty + 1)}
                            className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-base transition-all"
                            style={{ background: "#dcfce7", color: "#166534" }}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex flex-col">
              <div className="px-4 py-3 text-xs font-bold" style={{ color: "rgba(51,38,29,0.45)", background: "#faf6ef" }}>
                سفارش جدید
              </div>
              <div className="flex-1 px-4 py-3">
                {lines.length === 0
                  ? <p className="text-sm text-center py-8" style={{ color: "rgba(51,38,29,0.35)" }}>هیچ آیتمی انتخاب نشده</p>
                  : <ul className="space-y-2">
                      {lines.map((line) => (
                        <li key={line.product.id} className="flex items-center justify-between text-sm">
                          <span style={{ color: "#33261D" }}>
                            {line.product.name}
                            <span style={{ color: "rgba(51,38,29,0.4)" }}> × {faNum(line.quantity)}</span>
                          </span>
                          <span className="font-semibold" style={{ color: "#B8791A" }}>
                            {formatToman(line.product.price * line.quantity)}
                          </span>
                        </li>
                      ))}
                    </ul>
                }
                <div className="mt-4 pt-3 border-t border-dashed" style={{ borderColor: "#e5e0d8" }}>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "rgba(51,38,29,0.5)" }}>قبلاً:</span>
                    <span style={{ color: "rgba(51,38,29,0.5)" }}>{formatToman(order.total_amount)}</span>
                  </div>
                  <div className="flex justify-between font-bold mt-1">
                    <span style={{ color: "#33261D" }}>جمع جدید:</span>
                    <span style={{ color: newTotal > order.total_amount ? "#991b1b" : newTotal < order.total_amount ? "#166534" : "#B8791A" }}>
                      {formatToman(newTotal)}
                    </span>
                  </div>
                  {newTotal !== order.total_amount && (
                    <div className="text-xs mt-1 text-left" style={{
                      color: newTotal > order.total_amount ? "#991b1b" : "#166534"
                    }}>
                      {newTotal > order.total_amount ? "▲" : "▼"} {formatToman(Math.abs(newTotal - order.total_amount))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {err && (
          <div className="mx-4 mb-2 rounded-xl px-4 py-2 text-sm" style={{ background: "#fef2f2", color: "#991b1b" }}>
            {err}
          </div>
        )}
        <div className="flex gap-3 px-5 py-4 border-t" style={{ borderColor: "#f0ebe3" }}>
          <button type="button" onClick={onClose} disabled={busy}
            className="flex-1 rounded-2xl py-3 text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: "#f3f4f6", color: "#6b7280" }}>انصراف</button>
          <button type="button" onClick={save} disabled={busy || lines.length === 0}
            className="flex-1 rounded-2xl py-3 text-sm font-bold text-white transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #E9A13B, #B8791A)" }}>
            {busy ? "در حال ذخیره…" : "✓ تأیید و ذخیره"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────── کامپوننت دکمه‌های تایید و پرینت ─────────────────────
interface ConfirmAndPrintProps {
  order: Order;
  onStatusChange: (orderId: number, status: OrderStatus, paymentMethod?: string) => Promise<void>;
  busy: boolean;
  onPaymentRequest: (order: Order) => void;
}

function ConfirmAndPrint({ order, onStatusChange, busy, onPaymentRequest }: ConfirmAndPrintProps) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirmAndPrint = async () => {
    setConfirming(true);
    try {
      // اگر سفارش هنوز completed نیست، ابتدا مودال پرداخت نشان بده
      if (order.status !== "completed") {
        onPaymentRequest(order);
        return;
      }
      // اگر قبلاً تکمیل شده، فقط پرینت بگیر
      printReceipt(order);
    } finally {
      setConfirming(false);
    }
  };

  const handleReprintOnly = () => {
    printReceipt(order);
  };

  const isCompleted = order.status === "completed";
  const isCancelled = order.status === "cancelled";

  if (isCancelled) return null;

  return (
    <div className="mt-3 flex gap-2">
      {!isCompleted ? (
        <button
          type="button"
          onClick={handleConfirmAndPrint}
          disabled={busy || confirming}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 2px 12px rgba(22,163,74,0.35)" }}
        >
          <span>🖨️</span>
          {confirming ? "در حال پردازش…" : "تایید و چاپ رسید"}
        </button>
      ) : (
        <div className="flex flex-1 items-center gap-2 rounded-2xl px-4 py-2.5"
          style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
          <span className="text-green-600 font-bold text-sm">✓ تحویل و تسویه شد</span>
          {order.payment_method && (
            <span className="text-xs" style={{ color: "rgba(51,38,29,0.4)" }}>
              ({order.payment_method === "cash" ? "نقدی" : "کارتخوان"})
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={handleReprintOnly}
        disabled={busy}
        className="flex items-center justify-center gap-1.5 rounded-2xl px-4 py-3 text-xs font-bold transition-all disabled:opacity-50"
        style={{ background: "#e0e7ff", color: "#3730a3" }}
        title="پرینت مجدد رسید"
      >
        <span>🔁</span>
        <span>چاپ مجدد</span>
      </button>
    </div>
  );
}

// ───────────────────────────── صفحه اصلی صندوق ─────────────────────────────

// ── تابع پخش صدای اعلان ──
function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch { /* AudioContext ممکن است در دسترس نباشد */ }
}

// ── مودال انتخاب روش پرداخت ──
interface PaymentModalProps {
  order: Order;
  onPayment: (method: string) => void;
  onClose: () => void;
  busy: boolean;
}

function PaymentModal({ order, onPayment, onClose, busy }: PaymentModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 text-center"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}
      >
        <span className="text-4xl">💳</span>
        <h2 className="mt-3 text-lg font-bold" style={{ color: "#33261D" }}>
          روش پرداخت
        </h2>
        <p className="mt-1 text-sm" style={{ color: "rgba(51,38,29,0.5)" }}>
          مبلغ: <span className="font-bold" style={{ color: "#B8791A" }}>{formatToman(order.total_amount)}</span>
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => onPayment("cash")}
            className="flex-1 rounded-2xl py-3.5 text-sm font-bold text-white transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #2F7D5D, #1a5c3a)" }}
          >
            💵 نقدی
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onPayment("card")}
            className="flex-1 rounded-2xl py-3.5 text-sm font-bold text-white transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #1d4ed8, #1e40af)" }}
          >
            💳 کارتخوان
          </button>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="mt-3 w-full rounded-xl py-2.5 text-sm font-bold transition-all"
          style={{ color: "rgba(51,38,29,0.4)" }}
        >
          انصراف
        </button>
      </div>
    </div>
  );
}

// ── Toast notification ──
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 animate-fade-in-up">
      <div
        className="flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-lg"
        style={{ background: "linear-gradient(135deg, #2F7D5D, #1a5c3a)" }}
      >
        <span className="text-lg">🔔</span>
        <span>{message}</span>
      </div>
    </div>
  );
}

export default function CashierPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("scan");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [scannedOrder, setScannedOrder] = useState<Order | null>(null);
  const [manualCode, setManualCode] = useState("");

  const [menu, setMenu] = useState<MenuCategory[] | null>(null);
  const [walkInCart, setWalkInCart] = useState<Record<number, number>>({});
  const [walkInName, setWalkInName] = useState("");
  const [walkInNote, setWalkInNote] = useState("");
  const [walkInResult, setWalkInResult] = useState<Order | null>(null);

  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // ── وضعیت WebSocket و Toast ──
  const [toast, setToast] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // ── وضعیت مودال پرداخت ──
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);

  const describeError = useCallback((e: unknown): string => {
    if (e instanceof ApiError && e.status === 401) {
      clearToken(); navigate("/login", { state: { from: "/cashier" } });
      return "نشست منقضی شد";
    }
    return e instanceof ApiError ? e.message : "خطای غیرمنتظره رخ داد";
  }, [navigate]);

  const fetchByCode = useCallback(async (code: string) => {
    const clean = code.trim(); if (!clean) return;
    setBusy(true); setError(null);
    try {
      const order = await api.get<Order>(`/api/cashier/orders/${encodeURIComponent(clean)}`);
      setScannedOrder(order);
    } catch (e) { setScannedOrder(null); setError(describeError(e)); }
    finally { setBusy(false); }
  }, [describeError]);

  const submitManualCode = (e: FormEvent) => { e.preventDefault(); fetchByCode(manualCode); };

  const changeStatus = async (orderId: number, status: OrderStatus, paymentMethod?: string) => {
    setBusy(true); setError(null);
    try {
      const body: { status: string; payment_method?: string } = { status };
      if (paymentMethod) body.payment_method = paymentMethod;
      const updated = await api.patch<Order>(`/api/cashier/orders/${orderId}/status`, body);
      setScannedOrder((prev) => (prev?.id === orderId ? updated : prev));
      setSelectedOrder((prev) => (prev?.id === orderId ? updated : prev));
      setWalkInResult((prev) => (prev?.id === orderId ? updated : prev));
      setTodayOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } catch (e) { setError(describeError(e)); }
    finally { setBusy(false); }
  };

  const loadMenu = useCallback(async () => {
    try { setMenu(await api.get<MenuCategory[]>("/api/menu")); }
    catch (e) { setError(describeError(e)); }
  }, [describeError]);

  useEffect(() => { loadMenu(); }, [loadMenu]);

  const allProducts = useMemo(() => (menu ?? []).flatMap((c) => c.products), [menu]);
  const walkInLines = useMemo(() =>
    allProducts.filter((p) => (walkInCart[p.id] ?? 0) > 0).map((p) => ({ product: p, quantity: walkInCart[p.id] })),
    [allProducts, walkInCart]);
  const walkInTotal = walkInLines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);

  const setWalkInQty = (productId: number, qty: number) => {
    setWalkInCart((prev) => { const next = { ...prev }; if (qty <= 0) delete next[productId]; else next[productId] = qty; return next; });
  };

  const submitWalkIn = async () => {
    if (walkInLines.length === 0 || busy) return;
    setBusy(true); setError(null);
    try {
      const order = await api.post<Order>("/api/cashier/orders", {
        items: walkInLines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
        customer_name: walkInName.trim() || null, note: walkInNote.trim() || null,
      });
      setWalkInResult(order); setWalkInCart({}); setWalkInName(""); setWalkInNote("");
    } catch (e) { setError(describeError(e)); loadMenu(); }
    finally { setBusy(false); }
  };

  const loadToday = useCallback(async (silent = false) => {
    try {
      const query = filter === "all" ? "" : `?status=${filter}`;
      const orders = await api.get<Order[]>(`/api/cashier/orders${query}`);
      setTodayOrders(orders);
      if (!silent) setError(null);
    } catch (e) { if (!silent) setError(describeError(e)); }
  }, [filter, describeError]);

  useEffect(() => {
    if (tab !== "today") return;
    loadToday();
    const timer = setInterval(() => loadToday(true), 15_000);
    return () => clearInterval(timer);
  }, [tab, loadToday]);

  // ── اتصال WebSocket برای اعلان سفارش جدید ──
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/orders`;

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "new_order") {
              // رفرش لیست سفارش‌های امروز
              loadToday(true);
              // پخش صدای اعلان
              playNotificationSound();
              // نمایش toast
              setToast(`🔔 سفارش جدید رسید! کد: ${data.code}`);
            }
          } catch { /* پیام نامعتبر */ }
        };

        ws.onclose = () => {
          // اتصال مجدد بعد از ۳ ثانیه
          setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, [loadToday]);

  const todayTotal = useMemo(() =>
    todayOrders.filter((o) => o.status === "completed").reduce((sum, o) => sum + o.total_amount, 0),
    [todayOrders]);

  const handleEditSaved = (updated: Order) => {
    setEditingOrder(null);
    setScannedOrder((prev) => (prev?.id === updated.id ? updated : prev));
    setSelectedOrder((prev) => (prev?.id === updated.id ? updated : prev));
    setWalkInResult((prev) => (prev?.id === updated.id ? updated : prev));
    setTodayOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const EditBtn = ({ order }: { order: Order }) => {
    const canEdit = EDITABLE_STATUSES.includes(order.status as OrderStatus);
    if (!canEdit) return null;
    return (
      <button
        type="button"
        onClick={() => { if (menu) setEditingOrder(order); }}
        className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all"
        style={{ background: "#e0e7ff", color: "#3730a3" }}
        title="ویرایش آیتم‌های سفارش"
      >
        <span>✏️</span> ویرایش سفارش
      </button>
    );
  };

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-6" dir="rtl">
      <PanelHeader title="پنل صندوق" />

      {/* tab bar */}
      <div className="mb-6 flex gap-2 rounded-2xl p-1.5" style={{ background: "rgba(51,38,29,0.06)" }}>
        {TABS.map((t) => (
          <button key={t.id} type="button"
            onClick={() => { setTab(t.id); setError(null); }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all"
            style={tab === t.id
              ? { background: "white", color: "#33261D", boxShadow: "0 2px 8px rgba(51,38,29,0.12)" }
              : { color: "rgba(51,38,29,0.45)" }}>
            <span>{t.icon}</span><span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm"
          style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>
          <span>⚠️</span><span>{error}</span>
        </div>
      )}

      {/* ── SCAN TAB ── */}
      {tab === "scan" && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-5" style={{ boxShadow: "0 2px 16px rgba(51,38,29,0.08)", border: "1px solid #f0ebe3" }}>
            <h2 className="mb-4 flex items-center gap-2 font-bold" style={{ color: "#33261D" }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl text-lg" style={{ background: "#F7E6C4" }}>📷</span>
              اسکن QR مشتری
            </h2>
            <QrScanner onScan={fetchByCode} />
            <form onSubmit={submitManualCode} className="mt-4 flex gap-2">
              <input type="text" value={manualCode} onChange={(e) => setManualCode(e.target.value)}
                placeholder="یا کد سفارش را دستی وارد کن" dir="ltr"
                className="w-full rounded-xl border px-3 py-2.5 text-center font-mono text-sm tracking-widest outline-none transition-all"
                style={{ borderColor: "#e5e0d8", background: "#faf6ef" }} />
              <button type="submit" disabled={busy || !manualCode.trim()}
                className="whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #E9A13B, #B8791A)" }}>جستجو</button>
            </form>
          </div>
          <div>
            {scannedOrder ? (
              <div className="space-y-2">
                <div className="flex items-center justify-end">
                  <EditBtn order={scannedOrder} />
                </div>
                <OrderCard order={scannedOrder} onStatusChange={changeStatus} busy={busy} />
                <ConfirmAndPrint order={scannedOrder} onStatusChange={changeStatus} busy={busy} onPaymentRequest={setPaymentOrder} />
              </div>
            ) : (
              <div className="flex h-full min-h-52 items-center justify-center rounded-2xl text-center text-sm"
                style={{ border: "2px dashed #e5e0d8", color: "rgba(51,38,29,0.35)" }}>
                <div><span className="block text-4xl mb-3">📱</span>بعد از اسکن، سفارش اینجا نمایش داده می‌شود</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── WALK-IN TAB ── */}
      {tab === "walkin" && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-4" style={{ boxShadow: "0 2px 16px rgba(51,38,29,0.08)", border: "1px solid #f0ebe3" }}>
            {!menu
              ? <p className="py-4 text-center text-sm" style={{ color: "rgba(51,38,29,0.4)" }}>در حال دریافت منو…</p>
              : <WalkInMenuGrid menu={menu} cart={walkInCart} onQtyChange={setWalkInQty} onRefresh={loadMenu} />
            }
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-5" style={{ boxShadow: "0 2px 16px rgba(51,38,29,0.08)", border: "1px solid #f0ebe3" }}>
              <h2 className="mb-4 flex items-center gap-2 font-bold" style={{ color: "#33261D" }}>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "#F7E6C4" }}>🧾</span>
                سفارش حضوری
              </h2>
              {walkInLines.length === 0
                ? <p className="text-sm" style={{ color: "rgba(51,38,29,0.4)" }}>هنوز چیزی انتخاب نشده</p>
                : <ul className="space-y-2">
                    {walkInLines.map((line) => (
                      <li key={line.product.id} className="flex items-center justify-between text-sm">
                        <span style={{ color: "#33261D" }}>{line.product.name}
                          <span style={{ color: "rgba(51,38,29,0.4)" }}> × {faNum(line.quantity)}</span>
                        </span>
                        <span className="font-semibold" style={{ color: "#B8791A" }}>{formatToman(line.product.price * line.quantity)}</span>
                      </li>
                    ))}
                  </ul>
              }
              <div className="my-3 border-t border-dashed" style={{ borderColor: "#e5e0d8" }} />
              <div className="flex items-center justify-between font-bold">
                <span style={{ color: "#33261D" }}>جمع کل</span>
                <span style={{ color: "#B8791A" }}>{formatToman(walkInTotal)}</span>
              </div>
              <input type="text" value={walkInName} onChange={(e) => setWalkInName(e.target.value)}
                placeholder="اسم مشتری (اختیاری)" maxLength={100}
                className="mt-4 w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all"
                style={{ borderColor: "#e5e0d8", background: "#faf6ef" }} />
              <textarea value={walkInNote} onChange={(e) => setWalkInNote(e.target.value)}
                placeholder="توضیحات (اختیاری)" maxLength={500} rows={2}
                className="mt-2 w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all resize-none"
                style={{ borderColor: "#e5e0d8", background: "#faf6ef" }} />
              <button type="button" disabled={busy || walkInLines.length === 0} onClick={submitWalkIn}
                className="mt-3 w-full rounded-2xl py-3 font-bold text-white transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #E9A13B, #B8791A)" }}>
                {busy ? "در حال ثبت…" : "ثبت سفارش حضوری"}
              </button>
            </div>
            {walkInResult && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold" style={{ color: "#2F7D5D" }}>✓ ثبت شد — رسید سفارش:</span>
                  <button type="button" onClick={() => setWalkInResult(null)}
                    className="text-xs underline" style={{ color: "rgba(51,38,29,0.4)" }}>بستن رسید</button>
                </div>
                <OrderCard order={walkInResult} onStatusChange={changeStatus} busy={busy} />
                <ConfirmAndPrint order={walkInResult} onStatusChange={changeStatus} busy={busy} onPaymentRequest={setPaymentOrder} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TODAY TAB ── */}
      {tab === "today" && (
        <div className="space-y-4">
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" onClick={() => setFilter(f.id)}
                className="whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-all"
                style={filter === f.id
                  ? { background: f.color, color: "white", boxShadow: `0 2px 8px ${f.color}40` }
                  : { background: "white", color: f.color, border: `1px solid ${f.color}40` }}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-2xl px-5 py-4"
            style={{ background: "linear-gradient(135deg, #e3f0e9, #d1e8db)", border: "1px solid #b8dac8" }}>
            <div>
              <p className="text-xs font-medium" style={{ color: "#2F7D5D" }}>فروش امروز (تحویل‌شده)</p>
              <p className="mt-0.5 text-xl font-extrabold" style={{ color: "#1a5c3a" }}>{formatToman(todayTotal)}</p>
            </div>
            <span className="text-3xl opacity-70">💰</span>
          </div>

          {selectedOrder && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: "#33261D" }}>جزئیات سفارش انتخاب‌شده</span>
                <div className="flex items-center gap-2">
                  <EditBtn order={selectedOrder} />
                  <button type="button" onClick={() => setSelectedOrder(null)}
                    className="text-xs underline" style={{ color: "rgba(51,38,29,0.4)" }}>بستن</button>
                </div>
              </div>
              <OrderCard order={selectedOrder} onStatusChange={changeStatus} busy={busy} />
              <ConfirmAndPrint order={selectedOrder} onStatusChange={changeStatus} busy={busy} onPaymentRequest={setPaymentOrder} />
            </div>
          )}

          {todayOrders.length === 0
            ? <div className="py-16 text-center">
                <span className="text-5xl">📋</span>
                <p className="mt-3 text-sm" style={{ color: "rgba(51,38,29,0.4)" }}>امروز هنوز سفارشی با این وضعیت نیست</p>
              </div>
            : <div className="overflow-hidden rounded-2xl bg-white" style={{ boxShadow: "0 2px 16px rgba(51,38,29,0.08)", border: "1px solid #f0ebe3" }}>
                {todayOrders.map((order) => (
                  <button key={order.id} type="button" onClick={() => setSelectedOrder(order)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-right transition-colors last:border-b-0 hover:bg-amber-50"
                    style={{ borderBottom: "1px solid #f7f3ee" }}>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold" style={{ color: "#B8791A" }} dir="ltr">{order.code}</span>
                      {order.queue_number && (
                        <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                          style={{ background: "#E9A13B" }}>
                          #{faNum(order.queue_number)}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: "rgba(51,38,29,0.45)" }}>{formatTime(order.created_at)}</span>
                      {order.customer_name && <span className="text-xs" style={{ color: "rgba(51,38,29,0.55)" }}>{order.customer_name}</span>}
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={order.source === "online"
                          ? { background: "#e0e7ff", color: "#3730a3" }
                          : { background: "#F7E6C4", color: "#B8791A" }}>
                        {order.source === "online" ? "آنلاین" : "حضوری"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold" style={{ color: "#33261D" }}>{formatToman(order.total_amount)}</span>
                      <StatusBadge status={order.status} />
                    </div>
                  </button>
                ))}
              </div>
          }
        </div>
      )}

      {/* مودال ویرایش سفارش */}
      {editingOrder && menu && (
        <EditOrderModal
          order={editingOrder}
          menu={menu}
          onClose={() => setEditingOrder(null)}
          onSaved={handleEditSaved}
        />
      )}

      {/* مودال انتخاب روش پرداخت */}
      {paymentOrder && (
        <PaymentModal
          order={paymentOrder}
          busy={busy}
          onClose={() => setPaymentOrder(null)}
          onPayment={async (method) => {
            await changeStatus(paymentOrder.id, "completed", method);
            setPaymentOrder(null);
          }}
        />
      )}

      {/* Toast notification */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
