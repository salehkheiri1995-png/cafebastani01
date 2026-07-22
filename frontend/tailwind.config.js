/** @type {import('tailwindcss').Config} */
// پالت رنگی از دنیای بستنی سنتی: زعفران، پسته، شیر و آلبالو
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FAF6EF", // پس‌زمینه شیری
        ink: "#33261D", // قهوه‌ای تیره متن
        saffron: {
          DEFAULT: "#E9A13B",
          dark: "#B8791A",
          light: "#F7E6C4",
        },
        pistachio: {
          DEFAULT: "#2F7D5D",
          light: "#E3F0E9",
        },
        berry: {
          DEFAULT: "#B3323B",
          light: "#F6E3E4",
        },
      },
      fontFamily: {
        vazir: ["Vazirmatn", "Tahoma", "sans-serif"],
      },
    },
  },
  plugins: [],
};
