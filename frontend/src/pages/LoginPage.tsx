import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, ApiError, setToken } from "../api/client";

// ورود به پنل صندوق / مدیریت با رمز عبور
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // بعد از ورود، به صفحه‌ای که کاربر می‌خواست برود هدایت می‌شود
  const from =
    (location.state as { from?: string } | null)?.from ?? "/cashier";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ token: string }>("/api/auth/login", {
        password,
      });
      setToken(res.token);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ورود ناموفق بود");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-xs rounded-2xl bg-white p-6 shadow-sm"
      >
        <div className="text-center text-3xl">🍨</div>
        <h1 className="mt-2 text-center text-lg font-extrabold">
          ورود به پنل کافه
        </h1>
        <p className="mt-1 text-center text-xs text-gray-500">
          صندوق و مدیریت منو
        </p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="رمز عبور"
          autoFocus
          className="mt-5 w-full rounded-xl border border-gray-200 bg-cream p-3 text-sm outline-none focus:border-saffron"
        />

        {error && (
          <p className="mt-3 rounded-xl bg-berry-light p-3 text-sm text-berry">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="mt-4 w-full rounded-xl bg-saffron py-3 font-bold text-white transition-opacity hover:bg-saffron-dark disabled:opacity-50"
        >
          {busy ? "در حال ورود…" : "ورود"}
        </button>
      </form>
    </div>
  );
}
