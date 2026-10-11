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
    <div
      dir="rtl"
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{ background: "linear-gradient(155deg, #241a14 0%, #2e231b 42%, #4a3728 78%, #6b4a1f 100%)" }}
    >
      {/* نورهای تزئینی */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(233,161,59,0.28) 0%, transparent 70%)" }} aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(47,125,93,0.22) 0%, transparent 70%)" }} aria-hidden="true" />
      <div className="dot-pattern pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />

      {/* کارت */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-4xl shadow-elevated"
        style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.14)" }}>

        {/* نوار بالای کارت */}
        <div className="gradient-saffron h-1 w-full" aria-hidden="true" />

        <div className="px-8 pb-8 pt-7">
          {/* لوگو */}
          <div className="mb-6 flex flex-col items-center gap-2.5">
            <div className="flex h-16 w-16 animate-float items-center justify-center rounded-3xl bg-white/10 text-3xl ring-1 ring-white/20">
              <span aria-hidden="true">🍨</span>
            </div>
            <h1 className="font-display text-3xl leading-tight text-white">کافه‌بستنی تی‌تی</h1>
            <p className="text-2xs tracking-wide text-white/45">پنل مدیریت داخلی</p>
          </div>

          <div className="mb-6 h-px w-full bg-white/10" aria-hidden="true" />

          <form onSubmit={submit} className="space-y-4">
            <div className="relative">
              <label htmlFor="panel-password" className="sr-only">رمز عبور</label>
              <input
                id="panel-password"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="رمز عبور"
                autoComplete="current-password"
                autoFocus
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "login-error" : undefined}
                className="w-full rounded-2xl border bg-white/10 py-3.5 pl-12 pr-4 text-sm text-white outline-none transition-all placeholder:text-white/40 focus:border-saffron/70 focus:bg-white/[0.14]"
                style={{ borderColor: error ? "rgba(179,50,59,0.7)" : "rgba(255,255,255,0.16)" }}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
                aria-pressed={showPass}
                className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-base transition-colors hover:bg-white/10"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                <span aria-hidden="true">{showPass ? "🙈" : "👁"}</span>
              </button>
            </div>

            {error && (
              <div id="login-error" role="alert"
                className="animate-fade-in-up flex items-center gap-2 rounded-2xl border border-berry/40 bg-berry/20 px-4 py-3 text-sm text-red-200">
                <span aria-hidden="true">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy || password.length === 0}
              className="gradient-saffron relative w-full overflow-hidden rounded-2xl py-3.5 text-sm font-bold text-white shadow-warm transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-40"
            >
              {busy ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  در حال ورود…
                </span>
              ) : (
                "ورود به پنل"
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-2xs text-white/30">دسترسی فقط برای پرسنل مجاز</p>
        </div>
      </div>
    </div>
  );
}
