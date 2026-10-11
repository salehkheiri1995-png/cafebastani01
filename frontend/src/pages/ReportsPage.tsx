import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, getToken, clearToken } from "../api/client";
import PanelHeader from "../components/PanelHeader";
import type { Order } from "../types";
import { faNum, formatToman } from "../utils/format";

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
  pending: "bg-saffron-light text-saffron-dark",
  preparing: "bg-blue-100 text-blue-800",
  ready: "bg-pistachio-light text-pistachio",
  completed: "bg-cream-200 text-ink-soft",
  cancelled: "bg-berry-light text-berry",
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [error, setError] = useState("");

  const [period, setPeriod] = useState<Period>("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState(""); // متن خام ورودی — هر تایپی درخواست نمی‌فرستد
  const [appliedSearch, setAppliedSearch] = useState(""); // مقدار اعمال‌شده روی فیلتر
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
    if (appliedSearch.trim()) params.set("search", appliedSearch.trim());
    if (statusFilter) params.set("status", statusFilter);
    return params.toString();
  }, [period, page, dateFrom, dateTo, appliedSearch, statusFilter]);

  // تنها effect ای که داده را بارگیری می‌کند — با لغو درخواست‌های در جریان هنگام تغییر فیلترها
  useEffect(() => {
    if (!getToken()) { navigate("/login"); return; }
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const q = buildQuery();
        const [data, countData, summaryData] = await Promise.all([
          api.get<Order[]>(`/api/reports/orders?${q}`, { signal: controller.signal }),
          api.get<{ total: number }>(`/api/reports/orders/count?${q}`, { signal: controller.signal }),
          api.get<Summary>(`/api/reports/summary?period=${period}${period === "custom" ? `&date_from=${dateFrom}&date_to=${dateTo}` : ""}`, { signal: controller.signal }),
        ]);
        if (cancelled) return;
        setOrders(data);
        setTotal(countData.total);
        setSummary(summaryData);
      } catch (e: unknown) {
        if (cancelled) return; // خطای لغو (abort) خطا محسوب نمی‌شود
        setError(e instanceof Error ? e.message : "خطا در دریافت اطلاعات");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setInitialLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [buildQuery, period, dateFrom, dateTo, navigate]);

  // تأخیر کوتاه روی جستجو: تایپ کردن نباید درخواست بفرستد
  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const exportFile = async (format: "excel" | "pdf") => {
    if (exporting) return;
    const token = getToken();
    if (!token) { navigate("/login"); return; }
    const params = new URLSearchParams();
    params.set("period", period);
    if (period === "custom") {
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
    }
    if (appliedSearch.trim()) params.set("search", appliedSearch.trim());
    if (statusFilter) params.set("status", statusFilter);
    const url = `/api/reports/export/${format}?${params.toString()}`;
    setExporting(format);
    setError("");
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        // پاسخ خطای سرور نباید به‌صورت فایل ذخیره شود — پیام detail نمایش داده می‌شود
        let detail = "خطا در تهیه فایل خروجی";
        try {
          const data: unknown = await res.json();
          if (typeof data === "object" && data !== null && "detail" in data && typeof (data as { detail: unknown }).detail === "string") {
            detail = (data as { detail: string }).detail;
          }
        } catch { /* بدنه JSON نبود — همان پیام پیش‌فرض */ }
        if (res.status === 401) {
          clearToken();
          navigate("/login");
          return;
        }
        setError(detail);
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `orders_report.${format === "excel" ? "xlsx" : "pdf"}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError("ارتباط با سرور برقرار نشد — خروجی گرفتن ناتمام ماند");
    } finally {
      setExporting(null);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-6" dir="rtl">
      <PanelHeader title="گزارش سفارش‌ها" />

      {/* فیلترها */}
      <div className="mb-6 rounded-2xl border border-cream-200 bg-white p-4 shadow-card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label htmlFor="report-period" className="mb-1 block text-xs font-medium" style={{ color: "rgba(51,38,29,0.5)" }}>بازه زمانی</label>
            <select
              id="report-period"
              value={period}
              onChange={e => { setPeriod(e.target.value as Period); setPage(1); }}
              className="w-full rounded-xl border bg-cream px-3 py-2 text-sm outline-none transition-all"
              style={{ borderColor: "#e5e0d8" }}
            >
              {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="report-status" className="mb-1 block text-xs font-medium" style={{ color: "rgba(51,38,29,0.5)" }}>وضعیت</label>
            <select
              id="report-status"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
              className="w-full rounded-xl border bg-cream px-3 py-2 text-sm outline-none transition-all"
              style={{ borderColor: "#e5e0d8" }}
            >
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="report-search" className="mb-1 block text-xs font-medium" style={{ color: "rgba(51,38,29,0.5)" }}>جستجو (کد سفارش / نام مشتری)</label>
            <div className="flex gap-2">
              <input
                id="report-search"
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && setAppliedSearch(search.trim())}
                placeholder="جستجو کنید..."
                className="flex-1 rounded-xl border bg-cream px-3 py-2 text-sm outline-none transition-all"
                style={{ borderColor: "#e5e0d8" }}
              />
              <button onClick={() => { setPage(1); setAppliedSearch(search.trim()); }}
                aria-label="جستجو"
                className="whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #E9A13B, #B8791A)" }}>
                🔍
              </button>
            </div>
          </div>

          {period === "custom" && (
            <>
              <div>
                <label htmlFor="report-date-from" className="mb-1 block text-xs font-medium" style={{ color: "rgba(51,38,29,0.5)" }}>از تاریخ</label>
                <input id="report-date-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="w-full rounded-xl border bg-cream px-3 py-2 text-sm outline-none transition-all"
                  style={{ borderColor: "#e5e0d8" }} />
              </div>
              <div>
                <label htmlFor="report-date-to" className="mb-1 block text-xs font-medium" style={{ color: "rgba(51,38,29,0.5)" }}>تا تاریخ</label>
                <input id="report-date-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="w-full rounded-xl border bg-cream px-3 py-2 text-sm outline-none transition-all"
                  style={{ borderColor: "#e5e0d8" }} />
              </div>
            </>
          )}
        </div>

        {/* دکمه‌های خروجی */}
        <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: "#f0ebe3" }}>
          <span className="text-xs font-medium" style={{ color: "rgba(51,38,29,0.4)" }}>خروجی:</span>
          <button
            onClick={() => exportFile("excel")}
            disabled={exporting !== null}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white transition-all disabled:opacity-50"
            style={{ background: "#2F7D5D" }}
          >
            {exporting === "excel"
              ? <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              : <>⬇ Excel</>}
          </button>
          <button
            onClick={() => exportFile("pdf")}
            disabled={exporting !== null}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white transition-all disabled:opacity-50"
            style={{ background: "#B3323B" }}
          >
            {exporting === "pdf"
              ? <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              : <>⬇ PDF</>}
          </button>
        </div>
      </div>

      {/* آمار خلاصه */}
      {summary && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-cream-200 bg-white p-4 text-center shadow-card">
            <div className="num text-2xl font-extrabold" style={{ color: "#B8791A" }}>{faNum(summary.total_count)}</div>
            <div className="mt-1 text-xs font-medium" style={{ color: "rgba(51,38,29,0.5)" }}>کل سفارش‌ها</div>
          </div>
          <div className="rounded-2xl border border-cream-200 bg-white p-4 text-center shadow-card">
            <div className="num text-2xl font-extrabold" style={{ color: "#2F7D5D" }}>{formatToman(summary.total_amount)}</div>
            <div className="mt-1 text-xs font-medium" style={{ color: "rgba(51,38,29,0.5)" }}>مجموع مبلغ</div>
          </div>
          <div className="rounded-2xl border border-cream-200 bg-white p-4 text-center shadow-card">
            <div className="num text-2xl font-extrabold" style={{ color: "#2F7D5D" }}>{faNum(summary.by_status["completed"]?.count ?? 0)}</div>
            <div className="mt-1 text-xs font-medium" style={{ color: "rgba(51,38,29,0.5)" }}>تکمیل شده</div>
          </div>
          <div className="rounded-2xl border border-cream-200 bg-white p-4 text-center shadow-card">
            <div className="num text-2xl font-extrabold" style={{ color: "#B3323B" }}>{faNum(summary.by_status["cancelled"]?.count ?? 0)}</div>
            <div className="mt-1 text-xs font-medium" style={{ color: "rgba(51,38,29,0.5)" }}>لغو شده</div>
          </div>
        </div>
      )}

      {/* جدول */}
      <div className="overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-card">
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "#f0ebe3" }}>
          <span className="font-bold" style={{ color: "#33261D" }}>لیست سفارش‌ها</span>
          <span className="num text-sm" style={{ color: "rgba(51,38,29,0.4)" }}>{faNum(total)} سفارش</span>
        </div>

        {error && (
          <div className="mx-4 my-3 rounded-xl px-4 py-3 text-sm" style={{ background: "#fef2f2", color: "#991b1b" }} role="alert">
            {error}
          </div>
        )}

        {/* اسکلت بارگذاری اولیه — جای خالی چشمک نزند */}
        {initialLoading && (
          <div className="space-y-3 p-4" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-xl bg-cream-200" />
            ))}
          </div>
        )}

        {!initialLoading && loading && (
          <div className="py-12 text-center text-sm" style={{ color: "rgba(51,38,29,0.35)" }}>
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-saffron/30 border-t-saffron" />
            <p className="mt-2">در حال بارگذاری...</p>
          </div>
        )}

        {!initialLoading && !loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#faf6ef" }}>
                  <th className="num px-4 py-3 text-right text-xs font-bold" style={{ color: "rgba(51,38,29,0.5)" }}>#</th>
                  <th className="px-4 py-3 text-right text-xs font-bold" style={{ color: "rgba(51,38,29,0.5)" }}>کد سفارش</th>
                  <th className="px-4 py-3 text-right text-xs font-bold" style={{ color: "rgba(51,38,29,0.5)" }}>نام مشتری</th>
                  <th className="px-4 py-3 text-right text-xs font-bold" style={{ color: "rgba(51,38,29,0.5)" }}>وضعیت</th>
                  <th className="px-4 py-3 text-right text-xs font-bold" style={{ color: "rgba(51,38,29,0.5)" }}>منبع</th>
                  <th className="num px-4 py-3 text-right text-xs font-bold" style={{ color: "rgba(51,38,29,0.5)" }}>مبلغ</th>
                  <th className="num px-4 py-3 text-right text-xs font-bold" style={{ color: "rgba(51,38,29,0.5)" }}>تاریخ ثبت</th>
                  <th className="px-4 py-3 text-right text-xs font-bold" style={{ color: "rgba(51,38,29,0.5)" }}>اقلام</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center" style={{ color: "rgba(51,38,29,0.3)" }}>
                    <span className="block text-4xl mb-2">📋</span>
                    سفارشی پیدا نشد
                  </td></tr>
                ) : orders.map((o, idx) => (
                  <tr key={o.id} className="transition-colors hover:bg-saffron-light/30" style={{ borderBottom: "1px solid #f7f3ee" }}>
                    <td className="num px-4 py-3" style={{ color: "rgba(51,38,29,0.35)" }}>{faNum((page - 1) * PAGE_SIZE + idx + 1)}</td>
                    <td className="px-4 py-3 font-mono font-bold" style={{ color: "#B8791A" }}>{o.code}</td>
                    <td className="px-4 py-3" style={{ color: "#33261D" }}>{o.customer_name || <span style={{ color: "rgba(51,38,29,0.25)" }}>—</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLORS[o.status] ?? "bg-cream-200 text-ink-soft"}`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={o.source === "online"
                          ? { background: "#e0e7ff", color: "#3730a3" }
                          : { background: "#F7E6C4", color: "#B8791A" }}>
                        {o.source === "online" ? "آنلاین" : "حضوری"}
                      </span>
                    </td>
                    <td className="num px-4 py-3 font-bold" style={{ color: "#33261D" }}>{formatToman(o.total_amount)}</td>
                    <td className="num px-4 py-3 text-xs" style={{ color: "rgba(51,38,29,0.5)" }}>
                      {new Date(o.created_at).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs" style={{ color: "rgba(51,38,29,0.45)" }}>
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
          <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: "#f0ebe3" }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-xl px-4 py-2 text-sm font-bold transition-all disabled:opacity-40"
              style={{ background: "#f3f4f6", color: "#6b7280" }}
            >
              قبلی
            </button>
            <span className="num text-sm" style={{ color: "rgba(51,38,29,0.5)" }}>
              صفحه {faNum(page)} از {faNum(totalPages)}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-xl px-4 py-2 text-sm font-bold transition-all disabled:opacity-40"
              style={{ background: "#f3f4f6", color: "#6b7280" }}
            >
              بعدی
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
