import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

// فونت‌ها به صورت لوکال بسته‌بندی می‌شوند (بدون وابستگی به CDN و بدون رندر بلاک خارجی)
import "@fontsource-variable/estedad";
import "@fontsource/lalezar/arabic.css";
import "@fontsource/lalezar/latin.css";

import "./index.css";

// نکته: StrictMode عمداً استفاده نشده تا اسکنر دوربین در حالت توسعه دوبار مقداردهی نشود
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
