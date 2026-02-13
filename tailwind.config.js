/** @type {import("tailwindcss").Config} */
module.exports = {
  darkMode: "class",
  content: ["./**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        panel: "var(--color-panel)",
        text: "var(--color-text)",
        muted: "var(--color-muted)",
        border: "var(--color-border)",
        accent: "var(--color-accent)",
        accentSoft: "var(--color-accent-soft)",
        danger: "var(--color-danger)"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.12)"
      },
      borderRadius: {
        xl: "14px"
      }
    }
  },
  plugins: []
}
