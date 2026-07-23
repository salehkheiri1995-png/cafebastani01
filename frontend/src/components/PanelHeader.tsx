import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearToken } from "../api/client";
import MenuPreviewModal from "./MenuPreviewModal";

export default function PanelHeader({ title }: { title: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [previewOpen, setPreviewOpen] = useState(false);

  const logout = () => { clearToken(); navigate("/login"); };

  const navItems = [
    { to: "/cashier", label: "صندوق", icon: "🏪" },
    { to: "/admin", label: "مدیریت منو", icon: "⚙️" },
    { to: "/reports", label: "گزارش‌ها", icon: "📊" },
  ];

  return (
    <>
      <header className="-mx-4 -mt-6 mb-6 px-4 pt-4 pb-3"
        style={{ background: "linear-gradient(135deg, #33261D 0%, #4a2c1a 100%)", boxShadow: "0 4px 24px rgba(51,38,29,0.3)" }}>
        <div className="mx-auto max-w-4xl">
          {/* top row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🍨</span>
              <div>
                <h1 className="text-base font-extrabold text-white leading-tight">{title}</h1>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>کافه‌بستنی تی‌تی</p>
              </div>
            </div>
            <button onClick={logout} type="button"
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all"
              style={{ background: "rgba(179,50,59,0.2)", border: "1px solid rgba(179,50,59,0.3)", color: "#fca5a5" }}>
              <span>خروج</span>
              <span>↩</span>
            </button>
          </div>

          {/* nav tabs */}
          <nav className="mt-3 flex items-center gap-1">
            {navItems.map(item => {
              const active = location.pathname === item.to;
              return (
                <Link key={item.to} to={item.to}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all"
                  style={active
                    ? { background: "rgba(233,161,59,0.25)", color: "#E9A13B", border: "1px solid rgba(233,161,59,0.35)" }
                    : { color: "rgba(255,255,255,0.55)", border: "1px solid transparent" }}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <button type="button" onClick={() => setPreviewOpen(true)}
              className="mr-auto flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all"
              style={{ color: "rgba(255,255,255,0.55)", border: "1px solid transparent" }}>
              <span>👁</span>
              <span>منوی مشتری</span>
            </button>
          </nav>
        </div>
      </header>
      {previewOpen && <MenuPreviewModal onClose={() => setPreviewOpen(false)} />}
    </>
  );
}
