import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// کامپوننت مرز خطا — خطاهای React را catch می‌کند و صفحه جایگزین نمایش می‌دهد
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("خطای React:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 text-center"
          dir="rtl"
        >
          <span className="mb-4 text-6xl" aria-hidden="true">⚠️</span>
          <h2 className="font-display mb-2 text-2xl text-ink">مشکلی پیش آمد</h2>
          <p className="mb-6 max-w-md text-sm text-ink-muted">
            {this.state.error?.message || "خطای غیرمنتظره‌ای رخ داد"}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = "/";
            }}
            className="gradient-saffron rounded-xl px-6 py-3 text-sm font-bold text-white shadow-warm transition-all active:scale-95"
          >
            بازگشت به صفحه اصلی
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
