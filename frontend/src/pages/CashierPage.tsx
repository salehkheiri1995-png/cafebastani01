import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, clearToken } from "../api/client";
import OrderCard from "../components/OrderCard";
import PanelHeader from "../components/PanelHeader";
import QrScanner from "../components/QrScanner";
import QtyControl from "../components/QtyControl";
import StatusBadge from "../components/StatusBadge";
import type { MenuCategory, Order, OrderStatus } from "../types";
import { faNum, formatTime, formatToman } from "../utils/format";

type Tab = "scan" | "walkin" | "today";

const TABS: { id: Tab; label: string }[] = [
  { id: "scan", label: "اسکن QR" },
  { id: "walkin", label: "سفارش دستی" },
  { id: "today", label: "سفارش‌های امروز" },
];

const FILTERS: { id: OrderStatus | "all"; label: string }[] = [
  { id: "all", label: "همه" },
  { id: "pending", label: "در انتظار" },
  { id: "preparing", label: "در حال آماده‌سازی" },
  { id: "ready", label: "آماده تحویل" },
  { id: "completed", label: "تحویل‌شده" },
  { id: "cancelled", label: "لغوشده" },
];

// پنل صندوق: اسکن QR سفارش، ثبت سفارش حضوری، لیست سفارش‌های امروز
export default function CashierPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("scan");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // --- تب اسکن ---
  const [scannedOrder, setScannedOrder] = useState<Order | null>(null);
  const [manualCode, setManualCode] = useState("");

  // --- تب سفارش دستی ---
  const [menu, setMenu] = useState<MenuCategory[] | null>(null);
  const [walkInCart, setWalkInCart] = useState<Record<number, number>>({});
  const [walkInName, setWalkInName] = useState("");
  const [walkInNote, setWalkInNote] = useState("");
  const [walkInResult, setWalkInResult] = useState<Order | null>(null);

  // --- تب سفارش‌های امروز ---
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // اگر توکن منقضی شده بود، به صفحه ورود برگرد؛ وگرنه پیام خطا بده
  const describeError = useCallback(
    (e: unknown): string => {
      if (e instanceof ApiError && e.status === 401) {
        clearToken();
        navigate("/login", { state: { from: "/cashier" } });
        return "نشست منقضی شد — دوباره وارد شوید";
      }
      return e instanceof ApiError ? e.message : "خطای غیرمنتظره رخ داد";
    },
    [navigate],
  );

  // ---------- اسکن ----------

  const fetchByCode = useCallback(
    async (code: string) => {
      const clean = code.trim();
      if (!clean) return;
      setBusy(true);
      setError(null);
      try {
        const order = await api.get<Order>(
          `/api/cashier/orders/${encodeURIComponent(clean)}`,
        );
        setScannedOrder(order);
      } catch (e) {
        setScannedOrder(null);
        setError(describeError(e));
      } finally {
        setBusy(false);
      }
    },
    [describeError],
  );

  const submitManualCode = (e: FormEvent) => {
    e.preventDefault();
    fetchByCode(manualCode);
  };

  // ---------- تغییر وضعیت (مشترک بین تب‌ها) ----------

  const changeStatus = async (orderId: number, status: OrderStatus) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patch<Order>(
        `/api/cashier/orders/${orderId}/status`,
        { status },
      );
      setScannedOrder((prev) => (prev?.id === orderId ? updated : prev));
      setSelectedOrder((prev) => (prev?.id === orderId ? updated : prev));
      setWalkInResult((prev) => (prev?.id === orderId ? updated : prev));
      setTodayOrders((prev) =>
        prev.map((o) => (o.id === orderId ? updated : o)),
      );
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  // ---------- سفارش دستی ----------

  const loadMenu = useCallback(async () => {
    try {
      setMenu(await api.get<MenuCategory[]>("/api/menu"));
    } catch (e) {
      setError(describeError(e));
    }
  }, [describeError]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const allProducts = useMemo(
    () => (menu ?? []).flatMap((c) => c.products),
    [menu],
  );
  const walkInLines = useMemo(
    () =>
      allProducts
        .filter((p) => (walkInCart[p.id] ?? 0) > 0)
        .map((p) => ({ product: p, quantity: walkInCart[p.id] })),
    [allProducts, walkInCart],
  );
  const walkInTotal = walkInLines.reduce(
    (sum, l) => sum + l.product.price * l.quantity,
    0,
  );

  const setWalkInQty = (productId: number, qty: number) => {
    setWalkInCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  };

  const submitWalkIn = async () => {
    if (walkInLines.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const order = await api.post<Order>("/api/cashier/orders", {
        items: walkInLines.map((l) => ({
          product_id: l.product.id,
          quantity: l.quantity,
        })),
        customer_name: walkInName.trim() || null,
        note: walkInNote.trim() || null,
      });
      setWalkInResult(order);
      setWalkInCart({});
      setWalkInName("");
      setWalkInNote("");
    } catch (e) {
      setError(describeError(e));
      loadMenu();
    } finally {
      setBusy(false);
    }
  };

  // ---------- سفارش‌های امروز ----------

  const loadToday = useCallback(
    async (silent = false) => {
      try {
        const query = filter === "all" ? "" : `?status=${filter}`;
        const orders = await api.get<Order[]>(`/api/cashier/orders${query}`);
        setTodayOrders(orders);
        if (!silent) setError(null);
      } catch (e) {
        if (!silent) setError(describeError(e));
      }
    },
    [filter, describeError],
  );

  // فقط وقتی تب «امروز» باز است، هر ۱۵ ثانیه لیست تازه می‌شود
  useEffect(() => {
    if (tab !== "today") return;
    loadToday();
    const timer = setInterval(() => loadToday(true), 15_000);
    return () => clearInterval(timer);
  }, [tab, loadToday]);

  const todayTotal = useMemo(
    () =>
      todayOrders
        .filter((o) => o.status === "completed")
        .reduce((sum, o) => sum + o.total_amount, 0),
    [todayOrders],
  );

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-6">
      <PanelHeader title="پنل صندوق" />

      {/* تب‌ها */}
      <div className="mb-5 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setError(null);
            }}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              tab === t.id ? "bg-ink text-white" : "bg-white hover:bg-saffron-light"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-berry-light p-3 text-sm text-berry">
          {error}
        </div>
      )}

      {/* ---------- تب اسکن QR ---------- */}
      {tab === "scan" && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-bold">اسکن QR مشتری</h2>
            <QrScanner onScan={fetchByCode} />
            <form onSubmit={submitManualCode} className="mt-4 flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="یا کد سفارش را دستی وارد کن"
                dir="ltr"
                className="w-full rounded-xl border border-gray-200 bg-cream p-3 text-center font-mono text-sm tracking-widest outline-none focus:border-saffron"
              />
              <button
                type="submit"
                disabled={busy || !manualCode.trim()}
                className="whitespace-nowrap rounded-xl bg-saffron px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                جستجو
              </button>
            </form>
          </div>

          <div>
            {scannedOrder ? (
              <OrderCard
                order={scannedOrder}
                onStatusChange={changeStatus}
                busy={busy}
              />
            ) : (
              <div className="flex h-full min-h-48 items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 p-5 text-center text-sm text-gray-400">
                بعد از اسکن، سفارش این‌جا نمایش داده می‌شود
                <br />
                (سفارش‌های در انتظار، خودکار وارد آماده‌سازی می‌شوند)
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- تب سفارش دستی ---------- */}
      {tab === "walkin" && (
        <div className="grid gap-5 md:grid-cols-2">
          {/* انتخاب از منو */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">انتخاب از منو</h2>
              <button
                type="button"
                onClick={loadMenu}
                className="text-xs font-bold text-saffron-dark underline"
              >
                تازه‌سازی منو
              </button>
            </div>
            {!menu && <p className="text-sm text-gray-400">در حال دریافت…</p>}
            <div className="max-h-[26rem] space-y-4 overflow-y-auto pl-1">
              {menu?.map((cat) => (
                <div key={cat.id}>
                  <h3 className="mb-2 text-sm font-bold text-gray-500">
                    {cat.name}
                  </h3>
                  <div className="space-y-2">
                    {cat.products.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between gap-2 rounded-xl bg-cream px-3 py-2"
                      >
                        <div className="min-w-0 text-sm">
                          <span className="font-medium">{product.name}</span>
                          <span className="mr-2 text-xs text-gray-500">
                            {formatToman(product.price)}
                          </span>
                        </div>
                        <QtyControl
                          value={walkInCart[product.id] ?? 0}
                          onChange={(qty) => setWalkInQty(product.id, qty)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* خلاصه و ثبت */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-bold">سفارش حضوری</h2>
              {walkInLines.length === 0 ? (
                <p className="text-sm text-gray-400">
                  هنوز چیزی انتخاب نشده
                </p>
              ) : (
                <ul className="space-y-2">
                  {walkInLines.map((line) => (
                    <li
                      key={line.product.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>
                        {line.product.name}
                        <span className="text-gray-500">
                          {" "}
                          × {faNum(line.quantity)}
                        </span>
                      </span>
                      <span className="font-medium">
                        {formatToman(line.product.price * line.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="receipt-divider my-3" />
              <div className="flex items-center justify-between font-bold">
                <span>جمع کل</span>
                <span className="text-saffron-dark">
                  {formatToman(walkInTotal)}
                </span>
              </div>

              <input
                type="text"
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                placeholder="اسم مشتری (اختیاری)"
                maxLength={100}
                className="mt-4 w-full rounded-xl border border-gray-200 bg-cream p-3 text-sm outline-none focus:border-saffron"
              />
              <textarea
                value={walkInNote}
                onChange={(e) => setWalkInNote(e.target.value)}
                placeholder="توضیحات (اختیاری)"
                maxLength={500}
                rows={2}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-cream p-3 text-sm outline-none focus:border-saffron"
              />
              <button
                type="button"
                disabled={busy || walkInLines.length === 0}
                onClick={submitWalkIn}
                className="mt-3 w-full rounded-xl bg-saffron py-3 font-bold text-white hover:bg-saffron-dark disabled:opacity-50"
              >
                {busy ? "در حال ثبت…" : "ثبت سفارش حضوری"}
              </button>
            </div>

            {walkInResult && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-pistachio">
                    ✓ ثبت شد — رسید سفارش:
                  </h3>
                  <button
                    type="button"
                    onClick={() => setWalkInResult(null)}
                    className="text-xs text-gray-400 underline"
                  >
                    بستن رسید
                  </button>
                </div>
                <OrderCard
                  order={walkInResult}
                  onStatusChange={changeStatus}
                  busy={busy}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- تب سفارش‌های امروز ---------- */}
      {tab === "today" && (
        <div className="space-y-4">
          {/* فیلتر وضعیت */}
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                  filter === f.id
                    ? "bg-ink text-white"
                    : "bg-white hover:bg-saffron-light"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* جمع فروش تحویل‌شده امروز */}
          <div className="rounded-xl bg-pistachio-light px-4 py-2 text-sm">
            جمع فروش تحویل‌شدهٔ امروز:{" "}
            <span className="font-bold text-pistachio">
              {formatToman(todayTotal)}
            </span>
          </div>

          {selectedOrder && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold">جزئیات سفارش انتخاب‌شده</h3>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="text-xs text-gray-400 underline"
                >
                  بستن
                </button>
              </div>
              <OrderCard
                order={selectedOrder}
                onStatusChange={changeStatus}
                busy={busy}
              />
            </div>
          )}

          {/* لیست سفارش‌ها */}
          {todayOrders.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">
              امروز هنوز سفارشی با این وضعیت نیست
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              {todayOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 text-right last:border-b-0 hover:bg-cream"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold" dir="ltr">
                      {order.code}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTime(order.created_at)}
                    </span>
                    {order.customer_name && (
                      <span className="text-xs text-gray-500">
                        {order.customer_name}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {order.source === "online" ? "آنلاین" : "حضوری"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold">
                      {formatToman(order.total_amount)}
                    </span>
                    <StatusBadge status={order.status} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
