import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, getToken } from "../api/client";
import type { Order } from "../types";

type Period = "today" | "week" | "month" | "year" | "custom" | "all";
type StatusFilter = "" | "pending" | "preparing" | "ready" | "completed" | "cancelled";

const PERIOD_LABELS: Record<Period, string> = {
  today: "امروز",
  week: "این هفته",
  month: "این ماه",
  year: "امسال",
  custom: "بازه دلخواه",
  all: "همه زمان‌ها",
};

const STATUS_LABELS: Record<string, string> = {
  "": "همه وضعیت‌ها",
  pending: "در انتظار",
  preparing: "در حال آماده‌سازی",
  ready: "آماده",
  completed: "تکمیل شده",
  cancelled: "لغو شده",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  preparing: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
};

interface Summary {
  total_count: number;
  total_amount: number;
  by_status: Record<string, { count: number; amount: number }>;
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [period, setPeriod] = useState<Period>("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set("period", period);
    params.set("page", String(page));
    params.set("page_size", String(PAGE_SIZE));
    if (period === "custom") {
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
    }
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    return params.toString();
  }, [period, page, dateFrom, dateTo, search, statusFilter]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = buildQuery();
      const [data, countData, summaryData] = await Promise.all([
        api.get<Order[]>(`/api/reports/orders?${q}`),
        api.get<{ total: number }>(`/api/reports/orders/count?${q}`),
        api.get<Summary>(`/api/reports/summary?period=${period}${period === "custom" ? `&date_from=${dateFrom}&date_to=${dateTo}` : ""}`),
      ]);
      setOrders(data);
      setTotal(countData.total);
      setSummary(summaryData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطا در دریافت اطلاعات");
    } finally {
      setLoading(false);
    }
  }, [buildQuery, period, dateFrom, dateTo]);

  useEffect(() => {
    if (!getToken()) { navigate("/login"); return; }
    fetchOrders();
  }, [fetchOrders, navigate]);

  const exportFile = (format: "excel" | "pdf") => {
    const params = new URLSearchParams();
    params.set("period", period);
    if (period === "custom") {
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
    }
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    const token = getToken();
    const url = `/api/reports/export/${format}?${params.toString()}`;
    // دانلود با توکن
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `orders_report.${format === "excel" ? "xlsx" : "pdf"}`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50 rtl" dir="rtl">
      {/* هدر */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/admin")} className="text-gray-500 hover:text-gray-700 text-sm">← بازگشت به پنل</button>
            <h1 className="text-xl font-bold text-gray-800">📊 گزارش سفارش‌ها</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportFile("excel")}
              className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2 rounded-lg font-medium"
            >
              ⬇ Excel
            </button>
            <button
              onClick={() => exportFile("pdf")}
              className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-2 rounded-lg font-medium"
            >
              ⬇ PDF
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* فیلترها */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* بازه زمانی */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">بازه زمانی</label>
              <select
                value={period}
                onChange={e => { setPeriod(e.target.value as Period); setPage(1); }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                  <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
                ))}
              </select>
            </div>

            {/* وضعیت */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">وضعیت</label>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {/* جستجو */}
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">جستجو (کد سفارش / نام مشتری)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && fetchOrders()}
                  placeholder="جستجو کنید..."
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button onClick={() => { setPage(1); fetchOrders(); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
                  🔍
                </button>
              </div>
            </div>

            {/* بازه دلخواه */}
            {period === "custom" && (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">از تاریخ</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">تا تاریخ</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* آمار خلاصه */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border shadow-sm p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600">{summary.total_count.toLocaleString()}</div>
              <div className="text-sm text-gray-500 mt-1">کل سفارش‌ها</div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{summary.total_amount.toLocaleString()}</div>
              <div className="text-sm text-gray-500 mt-1">مجموع مبلغ (تومان)</div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{(summary.by_status["completed"]?.count ?? 0).toLocaleString()}</div>
              <div className="text-sm text-gray-500 mt-1">تکمیل شده</div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4 text-center">
              <div className="text-2xl font-bold text-red-500">{(summary.by_status["cancelled"]?.count ?? 0).toLocaleString()}</div>
              <div className="text-sm text-gray-500 mt-1">لغو شده</div>
            </div>
          </div>
        )}

        {/* جدول */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="font-medium text-gray-700">لیست سفارش‌ها</span>
            <span className="text-sm text-gray-400">{total.toLocaleString()} سفارش</span>
          </div>

          {error && <div className="p-4 text-red-600 text-sm">{error}</div>}
          {loading && <div className="p-8 text-center text-gray-400">در حال بارگذاری...</div>}

          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs">
                  <tr>
                    <th className="px-4 py-3 text-right">#</th>
                    <th className="px-4 py-3 text-right">کد سفارش</th>
                    <th className="px-4 py-3 text-right">نام مشتری</th>
                    <th className="px-4 py-3 text-right">وضعیت</th>
                    <th className="px-4 py-3 text-right">منبع</th>
                    <th className="px-4 py-3 text-right">مبلغ (تومان)</th>
                    <th className="px-4 py-3 text-right">تاریخ ثبت</th>
                    <th className="px-4 py-3 text-right">اقلام</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-gray-400">سفارشی پیدا نشد</td></tr>
                  ) : orders.map((o, idx) => (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-4 py-3 font-mono font-medium text-indigo-700">{o.code}</td>
                      <td className="px-4 py-3 text-gray-700">{o.customer_name || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[o.status] ?? o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{o.source === "online" ? "🌐 آنلاین" : "🏪 حضوری"}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{o.total_amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(o.created_at).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                        {o.items.map(it => `${it.product_name}×${it.quantity}`).join("، ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* صفحه‌بندی */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t flex items-center justify-between">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-sm px-3 py-1.5 rounded border disabled:opacity-40 hover:bg-gray-50"
              >
                قبلی
              </button>
              <span className="text-sm text-gray-500">صفحه {page} از {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="text-sm px-3 py-1.5 rounded border disabled:opacity-40 hover:bg-gray-50"
              >
                بعدی
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
