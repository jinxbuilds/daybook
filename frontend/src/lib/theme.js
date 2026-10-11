// Theme preference is a UI setting only (never auth data).
const KEY = "daybook-theme";

export function getTheme() {
  try {
    return localStorage.getItem(KEY) || "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "light" || theme === "dark") root.dataset.theme = theme;
  else delete root.dataset.theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage unavailable: theme just won't persist */
  }
}
