import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, clearToken } from "../api/client";
import OrderCard from "../components/OrderCard";
import PanelHeader from "../components/PanelHeader";
import QrScanner from "../components/QrScanner";
import StatusBadge from "../components/StatusBadge";
import WalkInMenuGrid from "../components/WalkInMenuGrid";
import type { MenuCategory, Order, OrderStatus } from "../types";
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

  const changeStatus = async (orderId: number, status: OrderStatus) => {
    setBusy(true); setError(null);
    try {
      const updated = await api.patch<Order>(`/api/cashier/orders/${orderId}/status`, { status });
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

  const todayTotal = useMemo(() =>
    todayOrders.filter((o) => o.status === "completed").reduce((sum, o) => sum + o.total_amount, 0),
    [todayOrders]);

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
            {scannedOrder
              ? <OrderCard order={scannedOrder} onStatusChange={changeStatus} busy={busy} />
              : <div className="flex h-full min-h-52 items-center justify-center rounded-2xl text-center text-sm"
                  style={{ border: "2px dashed #e5e0d8", color: "rgba(51,38,29,0.35)" }}>
                  <div><span className="block text-4xl mb-3">📱</span>بعد از اسکن، سفارش اینجا نمایش داده می‌شود</div>
                </div>
            }
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
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TODAY TAB ── */}
      {tab === "today" && (
        <div className="space-y-4">
          {/* filter chips */}
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

          {/* summary card */}
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
                <button type="button" onClick={() => setSelectedOrder(null)}
                  className="text-xs underline" style={{ color: "rgba(51,38,29,0.4)" }}>بستن</button>
              </div>
              <OrderCard order={selectedOrder} onStatusChange={changeStatus} busy={busy} />
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
    </div>
  );
}
