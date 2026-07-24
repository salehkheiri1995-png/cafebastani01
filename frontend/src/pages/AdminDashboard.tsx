import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, clearToken } from "../api/client";
import PanelHeader from "../components/PanelHeader";
import type { Order } from "../types";
import { faNum, formatToman } from "../utils/format";

interface TodayStats {
  total_orders: number;
  completed_orders: number;
  total_revenue: number;
  avg_amount: number;
}

interface RevenueDay {
  date: string;
  label: string;
  revenue: number;
  count: number;
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "در انتظار",
  preparing: "در حال آماده‌سازی",
  ready: "آماده",
  completed: "تکمیل شده",
  cancelled: "لغو شده",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-saffron-light text-saffron-dark",
  preparing: "bg-blue-100 text-blue-800",
  ready: "bg-pistachio-light text-pistachio",
  completed: "bg-gray-200 text-gray-600",
  cancelled: "bg-berry-light text-berry",
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [today, setToday] = useState<TodayStats | null>(null);
  const [weekRevenue, setWeekRevenue] = useState<RevenueDay[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const describeError = useCallback(
    (e: unknown): string => {
      if (e instanceof ApiError && e.status === 401) {
        clearToken();
        navigate("/login", { state: { from: "/admin/dashboard" } });
        return "نشست منقضی شد";
      }
      return e instanceof ApiError ? e.message : "خطا در دریافت اطلاعات";
    },
    [navigate],
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [todayData, weekData, topData, recentData] = await Promise.all([
        api.get<TodayStats>("/api/reports/dashboard/today"),
        api.get<RevenueDay[]>("/api/reports/dashboard/revenue-week"),
        api.get<TopProduct[]>("/api/reports/dashboard/top-products"),
        api.get<Order[]>("/api/reports/dashboard/recent-orders"),
      ]);
      setToday(todayData);
      setWeekRevenue(weekData);
      setTopProducts(topData);
      setRecentOrders(recentData);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, [describeError]);

  useEffect(() => {
    loadDashboard();
    const timer = setInterval(loadDashboard, 30_000);
    return () => clearInterval(timer);
  }, [loadDashboard]);

  if (loading && !today) {
    return (
      <div className="mx-auto min-h-screen max-w-5xl px-4 py-6" dir="rtl">
        <PanelHeader title="داشبورد مدیریت" />
        <div className="py-16 text-center">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-saffron/30 border-t-saffron" />
          <p className="mt-3 text-sm" style={{ color: "rgba(51,38,29,0.4)" }}>
            در حال بارگذاری...
          </p>
        </div>
      </div>
    );
  }

  // محاسبه بیشینه درآمد برای نمودار میله‌ای
  const maxRevenue = Math.max(...weekRevenue.map((d) => d.revenue), 1);

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-6" dir="rtl">
      <PanelHeader title="داشبورد مدیریت" />

      {error && (
        <div className="mb-4 rounded-xl bg-berry-light p-3 text-sm text-berry">
          {error}
        </div>
      )}

      {/* ── کارت‌های آمار بالا ── */}
      {today && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="درآمد امروز"
            value={formatToman(today.total_revenue)}
            icon="💰"
            color="#2F7D5D"
          />
          <StatCard
            label="سفارش‌های امروز"
            value={faNum(today.total_orders)}
            icon="📋"
            color="#B8791A"
          />
          <StatCard
            label="تحویل شده"
            value={faNum(today.completed_orders)}
            icon="✅"
            color="#1d4ed8"
          />
          <StatCard
            label="میانگین مبلغ"
            value={formatToman(today.avg_amount)}
            icon="📊"
            color="#7c3aed"
          />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* ── نمودار خطی درآمد ۷ روز اخیر ── */}
        <div
          className="rounded-2xl bg-white p-5"
          style={{
            boxShadow: "0 2px 16px rgba(51,38,29,0.08)",
            border: "1px solid #f0ebe3",
          }}
        >
          <h3 className="mb-4 font-bold" style={{ color: "#33261D" }}>
            📈 درآمد ۷ روز اخیر
          </h3>
          <div className="flex items-end gap-2" style={{ height: 160 }}>
            {weekRevenue.map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                <span
                  className="text-[10px] font-bold"
                  style={{ color: "#B8791A" }}
                >
                  {day.revenue > 0 ? faNum(Math.round(day.revenue / 1000)) + "k" : "0"}
                </span>
                <div
                  className="w-full rounded-t-lg transition-all duration-500"
                  style={{
                    height: `${Math.max((day.revenue / maxRevenue) * 120, 4)}px`,
                    background:
                      day.date === new Date().toISOString().slice(0, 10)
                        ? "linear-gradient(180deg, #E9A13B, #B8791A)"
                        : "linear-gradient(180deg, #f7e6c4, #e5d5b8)",
                    minHeight: 4,
                  }}
                />
                <span className="text-[10px]" style={{ color: "rgba(51,38,29,0.4)" }}>
                  {day.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── ۵ محصول پرفروش ── */}
        <div
          className="rounded-2xl bg-white p-5"
          style={{
            boxShadow: "0 2px 16px rgba(51,38,29,0.08)",
            border: "1px solid #f0ebe3",
          }}
        >
          <h3 className="mb-4 font-bold" style={{ color: "#33261D" }}>
            🏆 ۵ محصول پرفروش امروز
          </h3>
          {topProducts.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: "rgba(51,38,29,0.35)" }}>
              هنوز داده‌ای نیست
            </p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, idx) => {
                const maxQty = topProducts[0]?.quantity || 1;
                return (
                  <div key={p.name} className="flex items-center gap-3">
                    <span
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{
                        background:
                          idx === 0
                            ? "#E9A13B"
                            : idx === 1
                              ? "#B8791A"
                              : idx === 2
                                ? "#d4a04a"
                                : "#ccc",
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold truncate" style={{ color: "#33261D" }}>
                          {p.name}
                        </span>
                        <span className="text-xs font-bold mr-2" style={{ color: "#B8791A" }}>
                          {faNum(p.quantity)} عدد
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(p.quantity / maxQty) * 100}%`,
                            background: "linear-gradient(90deg, #E9A13B, #B8791A)",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── جدول سفارش‌های اخیر ── */}
      <div
        className="mt-6 overflow-hidden rounded-2xl bg-white"
        style={{
          boxShadow: "0 2px 16px rgba(51,38,29,0.08)",
          border: "1px solid #f0ebe3",
        }}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "#f0ebe3" }}>
          <h3 className="font-bold" style={{ color: "#33261D" }}>
            🕐 سفارش‌های اخیر
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#faf6ef" }}>
                <th className="px-4 py-3 text-right text-xs font-bold" style={{ color: "rgba(51,38,29,0.5)" }}>کد</th>
                <th className="px-4 py-3 text-right text-xs font-bold" style={{ color: "rgba(51,38,29,0.5)" }}>مشتری</th>
                <th className="px-4 py-3 text-right text-xs font-bold" style={{ color: "rgba(51,38,29,0.5)" }}>وضعیت</th>
                <th className="px-4 py-3 text-right text-xs font-bold" style={{ color: "rgba(51,38,29,0.5)" }}>مبلغ</th>
                <th className="px-4 py-3 text-right text-xs font-bold" style={{ color: "rgba(51,38,29,0.5)" }}>ساعت</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr
                  key={o.id}
                  className="transition-colors hover:bg-saffron-light/30"
                  style={{ borderBottom: "1px solid #f7f3ee" }}
                >
                  <td className="px-4 py-3 font-mono font-bold" style={{ color: "#B8791A" }}>
                    {o.code}
                  </td>
                  <td className="px-4 py-3" style={{ color: "#33261D" }}>
                    {o.customer_name || <span style={{ color: "rgba(51,38,29,0.25)" }}>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLORS[o.status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold" style={{ color: "#33261D" }}>
                    {formatToman(o.total_amount)}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "rgba(51,38,29,0.5)" }}>
                    {new Date(o.created_at).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center" style={{ color: "rgba(51,38,29,0.3)" }}>
                    سفارشی نیست
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <div
      className="rounded-2xl bg-white p-4 text-center"
      style={{
        boxShadow: "0 2px 16px rgba(51,38,29,0.08)",
        border: "1px solid #f0ebe3",
      }}
    >
      <div className="mb-2 text-2xl">{icon}</div>
      <div className="text-xl font-extrabold" style={{ color }}>
        {value}
      </div>
      <div className="mt-1 text-xs font-medium" style={{ color: "rgba(51,38,29,0.5)" }}>
        {label}
      </div>
    </div>
  );
}
