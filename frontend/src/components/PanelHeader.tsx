import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearToken } from "../api/client";
import MenuPreviewModal from "./MenuPreviewModal";

// آیتم‌های ناوبری پنل‌ها
const NAV = [
  { to: "/cashier", label: "صندوق" },
  { to: "/admin", label: "مدیریت منو" },
  { to: "/admin/dashboard", label: "داشبورد", emoji: "📊" },
  { to: "/reports", label: "گزارش‌ها" },
];

// سربرگ مشترک پنل صندوق و مدیریت
export default function PanelHeader({ title }: { title: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [previewOpen, setPreviewOpen] = useState(false);

  const logout = () => {
    clearToken();
    navigate("/login");
  };

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-display text-2xl leading-tight">
          <span aria-hidden="true">🍨</span>
          {title}
        </h1>
        <nav aria-label="ناوبری پنل" className="flex flex-wrap items-center gap-1 text-sm">
          {NAV.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`rounded-xl px-3 py-1.5 font-medium transition-colors ${
                  active ? "bg-ink text-white shadow-soft" : "text-ink-soft hover:bg-white"
                }`}
              >
                {item.emoji && <span aria-hidden="true">{item.emoji} </span>}
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="rounded-xl px-3 py-1.5 font-medium text-ink-soft transition-colors hover:bg-white"
          >
            <span aria-hidden="true">👁 </span>منوی مشتری
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl bg-berry-light px-3 py-1.5 font-bold text-berry transition-colors hover:bg-berry hover:text-white"
          >
            خروج
          </button>
        </nav>
      </header>

      {previewOpen && <MenuPreviewModal onClose={() => setPreviewOpen(false)} />}
    </>
  );
}
