/** Appearance preference — a per-device convenience, so localStorage is appropriate. */
export type ThemePreference = 'light' | 'dark' | 'system'
const KEY = 'reelcraft.theme'

export function getThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(preference: ThemePreference = getThemePreference()) {
  const dark =
    preference === 'dark' ||
    (preference === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', Boolean(dark))
}

export function setThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(KEY, preference)
  } catch {
    /* storage unavailable — still apply for this session */
  }
  applyTheme(preference)
}
