import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

// فونت‌ها به صورت لوکال و فقط با زیرمجموعهٔ عربی/فارسی (woff2) بسته‌بندی می‌شوند —
// تعریف @font-face در index.css انجام می‌شود تا از زیرمجموعه‌های بی‌استفاده و فونت قدیمی woff جلوگیری شود
import "./index.css";

// نکته: StrictMode عمداً استفاده نشده تا اسکنر دوربین در حالت توسعه دوبار مقداردهی نشود
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
