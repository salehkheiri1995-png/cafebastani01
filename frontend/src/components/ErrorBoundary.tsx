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
          className="flex min-h-screen flex-col items-center justify-center px-4 text-center"
          dir="rtl"
          style={{ background: "#FAF6EF" }}
        >
          <span className="mb-4 text-6xl">⚠️</span>
          <h2 className="mb-2 text-xl font-bold" style={{ color: "#33261D" }}>
            مشکلی پیش آمد
          </h2>
          <p className="mb-6 max-w-md text-sm" style={{ color: "rgba(51,38,29,0.5)" }}>
            {this.state.error?.message || "خطای غیرمنتظره‌ای رخ داد"}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = "/";
            }}
            className="rounded-xl px-6 py-3 text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #E9A13B, #B8791A)" }}
          >
            بازگشت به صفحه اصلی
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
