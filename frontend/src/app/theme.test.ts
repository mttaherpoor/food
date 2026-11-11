import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getCurrentTheme,
  getStoredTheme,
  getSystemTheme,
  initializeTheme,
  setTheme,
  THEME_CHANGED_EVENT,
  THEME_STORAGE_KEY,
  toggleTheme,
} from './theme'

describe('Theme Engine', () => {
  let listeners: Set<(event: MediaQueryListEvent) => void>
  let systemDark: boolean

  beforeEach(() => {
    listeners = new Set()
    systemDark = false

    localStorage.removeItem(THEME_STORAGE_KEY)
    delete document.documentElement.dataset.theme
    document.documentElement.style.removeProperty('color-scheme')

    vi.stubGlobal('matchMedia', vi.fn(() => ({
      get matches() { return systemDark },
      media: '(prefers-color-scheme: dark)',
      addEventListener: (_: string, cb: (event: MediaQueryListEvent) => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: (event: MediaQueryListEvent) => void) => listeners.delete(cb),
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.removeItem(THEME_STORAGE_KEY)
    delete document.documentElement.dataset.theme
    document.documentElement.style.removeProperty('color-scheme')
  })

  function systemChange(dark: boolean) {
    systemDark = dark
    for (const listener of listeners) {
      listener({ matches: dark } as MediaQueryListEvent)
    }
  }

  it('uses the system preference on first visit', () => {
    systemDark = true
    const cleanup = initializeTheme()

    expect(getSystemTheme()).toBe('dark')
    expect(getCurrentTheme()).toBe('dark')
    expect(getStoredTheme()).toBeNull()

    cleanup()
  })

  it('prioritizes the saved preference', () => {
    systemDark = true
    localStorage.setItem(THEME_STORAGE_KEY, 'light')

    const cleanup = initializeTheme()

    expect(getCurrentTheme()).toBe('light')

    cleanup()
  })

  it('toggles theme and persists the selection', () => {
    const cleanup = initializeTheme()

    toggleTheme()
    expect(getCurrentTheme()).toBe('dark')
    expect(getStoredTheme()).toBe('dark')

    toggleTheme()
    expect(getCurrentTheme()).toBe('light')
    expect(getStoredTheme()).toBe('light')

    cleanup()
  })

  it('restores the selected theme after reinitialization', () => {
    const cleanup = initializeTheme()
    setTheme('dark')
    cleanup()

    delete document.documentElement.dataset.theme

    const nextCleanup = initializeTheme()

    expect(getCurrentTheme()).toBe('dark')

    nextCleanup()
  })

  it('follows system changes only without a saved preference', () => {
    const cleanup = initializeTheme()

    systemChange(true)
    expect(getCurrentTheme()).toBe('dark')

    setTheme('light')
    systemChange(false)
    systemChange(true)

    expect(getCurrentTheme()).toBe('light')

    cleanup()
    expect(listeners.size).toBe(0)
  })

  it('supports environments without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)

    expect(getSystemTheme()).toBe('light')

    const cleanup = initializeTheme()
    expect(getCurrentTheme()).toBe('light')

    cleanup()
  })

  it('emits an event when theme changes', () => {
    const listener = vi.fn()
    window.addEventListener(THEME_CHANGED_EVENT, listener)

    try {
      setTheme('dark')
      expect(listener).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener(THEME_CHANGED_EVENT, listener)
    }
  })
})
