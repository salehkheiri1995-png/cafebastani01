import { lazy, Suspense, type ReactElement } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { getToken } from "./api/client";
import MenuPage from "./pages/MenuPage";
import OrderSuccessPage from "./pages/OrderSuccessPage";

// تقسیم باندل: پنل‌های داخلی فقط وقتی لازم شوند دانلود می‌شوند
// (صفحه منو — که مقصد QR است — سبک و سریع بارگذاری می‌شود)
const LoginPage = lazy(() => import("./pages/LoginPage"));
const CashierPage = lazy(() => import("./pages/CashierPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));

// گارد مسیرهای محافظت‌شده: بدون توکن → صفحه ورود
function RequireAuth({ children }: { children: ReactElement }) {
  const location = useLocation();
  if (!getToken()) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

// حالت بارگذاری هنگام دانلود باندل هر مسیر
function RouteFallback() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream"
      dir="rtl"
      role="status"
      aria-live="polite"
    >
      <span className="text-4xl animate-float">🍨</span>
      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-sand">
        <div className="h-full w-1/2 animate-shimmer rounded-full gradient-saffron" />
      </div>
      <p className="text-xs text-ink-muted">در حال آماده‌سازی…</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* منوی مشتری — همان صفحه‌ای که QR بیرون کافه به آن اشاره می‌کند */}
          <Route path="/" element={<MenuPage />} />
          {/* صفحه موفقیت سفارش + QR مخصوص سفارش */}
          <Route path="/order/:code" element={<OrderSuccessPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/cashier"
            element={
              <RequireAuth>
                <CashierPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <RequireAuth>
                <AdminDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/reports"
            element={
              <RequireAuth>
                <ReportsPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
