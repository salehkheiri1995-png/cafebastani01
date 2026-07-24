import type { ReactElement } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { getToken } from "./api/client";
import AdminPage from "./pages/AdminPage";
import AdminDashboard from "./pages/AdminDashboard";
import CashierPage from "./pages/CashierPage";
import LoginPage from "./pages/LoginPage";
import MenuPage from "./pages/MenuPage";
import OrderSuccessPage from "./pages/OrderSuccessPage";
import ReportsPage from "./pages/ReportsPage";

// گارد مسیرهای محافظت‌شده: بدون توکن → صفحه ورود
function RequireAuth({ children }: { children: ReactElement }) {
  const location = useLocation();
  if (!getToken()) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
