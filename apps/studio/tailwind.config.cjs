/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "var(--border)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        navy: "var(--navy)",
        soft: "var(--soft)",
      },
      fontFamily: {
        mono: ['"Fira Code"', "monospace"],
      },
    },
  },
  plugins: [],
};
