/** @type {import('tailwindcss').Config} */
// پالت رنگی از دنیای بستنی سنتی: زعفران، پسته، شیر و آلبالو
// فونت اصلی: Estedad Variable (خوانا و مدرن) — فونت عنوان: Lalezar (شخصیت بصری برند)
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#FAF6EF", // پس‌زمینه شیری
          50: "#FFFDFA",
          100: "#FAF6EF",
          200: "#F3EBDD",
          300: "#E9DFCC",
          400: "#DCCFB6",
        },
        ink: {
          DEFAULT: "#2E231B", // قهوه‌ای تیره متن
          soft: "#57473A",
          muted: "#8B7A6B",
          faint: "#B4A392",
        },
        saffron: {
          DEFAULT: "#E9A13B",
          dark: "#B8791A",
          light: "#F7E6C4",
          50: "#FDF6E9",
          100: "#F7E6C4",
          200: "#F0D49B",
          400: "#EFAE4E",
          500: "#E9A13B",
          600: "#CE8826",
          700: "#B8791A",
        },
        pistachio: {
          DEFAULT: "#2F7D5D",
          dark: "#215C43",
          light: "#E3F0E9",
        },
        berry: {
          DEFAULT: "#B3323B",
          dark: "#8E252D",
          light: "#F6E3E4",
        },
        sand: "#EFE6D6",
      },
      fontFamily: {
        sans: ["'Estedad Variable'", "Vazirmatn", "Tahoma", "sans-serif"],
        display: ["Lalezar", "'Estedad Variable'", "Tahoma", "sans-serif"],
        // نگهداری نام قبلی برای سازگاری با کدهای موجود
        vazir: ["'Estedad Variable'", "Vazirmatn", "Tahoma", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        // مقیاس‌های ریز برای برچسب‌ها و بج‌ها (به جای اندازه‌های دلخواه)
        "3xs": ["0.625rem", { lineHeight: "0.95rem" }],
        "2xs": ["0.6875rem", { lineHeight: "1.05rem" }],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(46, 35, 27, 0.04), 0 6px 16px -6px rgba(46, 35, 27, 0.10)",
        warm: "0 6px 20px -6px rgba(184, 121, 26, 0.35)",
        elevated: "0 24px 60px -20px rgba(46, 35, 27, 0.35)",
        card: "0 1px 0 rgba(46, 35, 27, 0.04), 0 10px 30px -18px rgba(46, 35, 27, 0.25)",
        "inner-soft": "inset 0 1px 0 rgba(255, 255, 255, 0.6)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      transitionTimingFunction: {
        "out-quint": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-8px) rotate(3deg)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(233, 161, 59, 0.45)" },
          "50%": { boxShadow: "0 0 0 8px rgba(233, 161, 59, 0)" },
        },
        "bounce-in": {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "60%": { transform: "scale(1.05)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        float: "float 3s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-in-right": "slide-in-right 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
        "bounce-in": "bounce-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1.8s linear infinite",
      },
    },
  },
  plugins: [],
};
