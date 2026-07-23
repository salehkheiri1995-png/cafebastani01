import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearToken } from "../api/client";
import MenuPreviewModal from "./MenuPreviewModal";

// سربرگ مشترک پنل صندوق و مدیریت
export default function PanelHeader({ title }: { title: string }) {
  const navigate = useNavigate();
  const [previewOpen, setPreviewOpen] = useState(false);

  const logout = () => {
    clearToken();
    navigate("/login");
  };

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">🍨 {title}</h1>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <Link to="/cashier" className="rounded-lg px-3 py-1.5 hover:bg-white">
            صندوق
          </Link>
          <Link to="/admin" className="rounded-lg px-3 py-1.5 hover:bg-white">
            مدیریت منو
          </Link>
          <Link
            to="/reports"
            className="rounded-lg bg-indigo-50 px-3 py-1.5 font-bold text-indigo-700 hover:bg-indigo-100"
          >
            📊 گزارش سفارش‌ها
          </Link>
          {/* به جای Link به "/"، مودال پیش‌نمایش باز می‌شود */}
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="rounded-lg px-3 py-1.5 hover:bg-white"
          >
            👁 منوی مشتری
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg bg-berry-light px-3 py-1.5 font-bold text-berry"
          >
            خروج
          </button>
        </nav>
      </header>

      {previewOpen && <MenuPreviewModal onClose={() => setPreviewOpen(false)} />}
    </>
  );
}
