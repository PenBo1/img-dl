export const applyTheme = (theme: "light" | "dark" | "system") => {
  const root = document.documentElement
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const shouldDark = theme === "dark" || (theme === "system" && prefersDark)
  root.classList.toggle("dark", shouldDark)
}
