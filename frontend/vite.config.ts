import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// پراکسی /api به بک‌اند FastAPI — نیازی به تنظیم CORS یا آدرس جداگانه نیست.
// host: true یعنی موبایل‌های داخل شبکه هم می‌توانند منو را باز کنند.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      // عکس محصولات (/static/products/...) هم از بک‌اند سرو می‌شود
      "/static": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      // پراکسی WebSocket برای اعلان سفارش جدید
      "/ws": {
        target: "ws://127.0.0.1:8000",
        ws: true,
      },
    },
  },
});
