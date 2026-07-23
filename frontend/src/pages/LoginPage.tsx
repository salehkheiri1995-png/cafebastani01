import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, ApiError, setToken } from "../api/client";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/cashier";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ token: string }>("/api/auth/login", { password });
      setToken(res.token);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "رمز عبور اشتباه است");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4" dir="rtl"
      style={{ background: "linear-gradient(145deg, #1a0f0a 0%, #33261D 40%, #4a2c1a 70%, #6b3a1f 100%)" }}>

      {/* decorative blobs */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(233,161,59,0.25) 0%, transparent 70%)" }} />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(47,125,93,0.2) 0%, transparent 70%)" }} />
      <div className="pointer-events-none absolute top-1/3 left-1/4 h-32 w-32 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(179,50,59,0.15) 0%, transparent 70%)" }} />

      {/* floating ice cream emojis */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
        {["🍨","🍦","🧁","🍧","☕"].map((e, i) => (
          <span key={i} className="absolute text-2xl opacity-10"
            style={{
              top: `${15 + i * 17}%`,
              left: `${8 + i * 18}%`,
              transform: `rotate(${-15 + i * 8}deg)`,
              fontSize: i % 2 === 0 ? "2rem" : "1.4rem",
            }}>{e}</span>
        ))}
      </div>

      {/* card */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl shadow-2xl"
        style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.12)" }}>

        {/* top accent line */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #E9A13B, #B8791A, #2F7D5D)" }} />

        <div className="px-8 pb-8 pt-7">
          {/* logo */}
          <div className="mb-6 flex flex-col items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-4xl">🍨</span>
              <span className="text-3xl">🍦</span>
              <span className="text-4xl">🍧</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-wide text-white">کافه‌بستنی تی‌تی</h1>
            <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>پنل مدیریت داخلی</p>
          </div>

          {/* divider */}
          <div className="mb-6 h-px w-full" style={{ background: "rgba(255,255,255,0.1)" }} />

          <form onSubmit={submit} className="space-y-4">
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="رمز عبور"
                autoFocus
                className="w-full rounded-2xl border py-3.5 pr-4 pl-12 text-sm outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  borderColor: error ? "rgba(179,50,59,0.6)" : "rgba(255,255,255,0.15)",
                  color: "white",
                }}
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-lg"
                style={{ color: "rgba(255,255,255,0.4)" }}>
                {showPass ? "🙈" : "👁"}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm"
                style={{ background: "rgba(179,50,59,0.2)", border: "1px solid rgba(179,50,59,0.3)", color: "#f87171" }}>
                <span>⚠️</span><span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={busy || password.length === 0}
              className="relative w-full overflow-hidden rounded-2xl py-3.5 text-sm font-bold text-white transition-all disabled:opacity-40"
              style={{ background: busy ? "rgba(233,161,59,0.5)" : "linear-gradient(135deg, #E9A13B 0%, #B8791A 100%)" }}>
              {busy ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  در حال ورود…
                </span>
              ) : "ورود به پنل"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            دسترسی فقط برای پرسنل مجاز
          </p>
        </div>
      </div>
    </div>
  );
}
