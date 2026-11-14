export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'pi-food:theme'
export const THEME_CHANGED_EVENT = 'pi-food:theme-changed'

export function getSystemTheme(): Theme {
  if (typeof window.matchMedia !== 'function') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function getStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

export function getCurrentTheme(): Theme {
  const value = document.documentElement.dataset.theme
  if (value === 'light' || value === 'dark') return value
  return getStoredTheme() ?? getSystemTheme()
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme

  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )

  if (meta) {
    meta.content = theme === 'dark' ? '#101B23' : '#F5F8F9'
  }

  window.dispatchEvent(
    new CustomEvent<Theme>(THEME_CHANGED_EVENT, { detail: theme }),
  )
}

export function setTheme(theme: Theme): void {
  applyTheme(theme)

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Theme still applies when storage is unavailable.
  }
}

export function toggleTheme(): void {
  setTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark')
}

export function initializeTheme(): () => void {
  applyTheme(getStoredTheme() ?? getSystemTheme())

  if (typeof window.matchMedia !== 'function') {
    return () => undefined
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)')

  function handleSystemChange(event: MediaQueryListEvent): void {
    if (!getStoredTheme()) {
      applyTheme(event.matches ? 'dark' : 'light')
    }
  }

  media.addEventListener('change', handleSystemChange)

  return () => media.removeEventListener('change', handleSystemChange)
}
