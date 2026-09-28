// Chế độ sáng/tối lưu theo từng thiết bị: "system" | "light" | "dark"
const KEY = 'theme'

export function getTheme() {
  try {
    return localStorage.getItem(KEY) || 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(theme = getTheme()) {
  const root = document.documentElement
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme
  else delete root.dataset.theme
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // bỏ qua nếu trình duyệt chặn localStorage
  }
  applyTheme(theme)
}
