import { useCallback, useEffect, useState } from 'react'
import type { Page } from './app/navigation'
import { canSeeReport, isManager } from './app/permissions'
import { ApiError } from './api/client'
import { getSession, login, logout } from './api/endpoints'
import type { User } from './api/types'
import MainShell from './components/layout/MainShell'
import LoginScreen from './pages/LoginPage'
import PasswordScreen from './pages/PasswordPage'
import WeekPage from './pages/WeekPage'
import HistoryPage from './pages/HistoryPage'
import ReportPage from './pages/ReportPage'
import CatalogPage from './pages/CatalogPage'
import { getApiMessage } from './utils/errors'

function readPage(): Page {
  const path = window.location.pathname.replace(/\/$/, '')
  if (path === '/history') return 'history'
  if (path === '/reports') return 'report'
  if (path === '/catalog' || path === '/menus') return 'catalog'
  return 'week'
}

function routeFor(page: Page) {
  return { week: '/reservations', history: '/history', report: '/reports', catalog: '/catalog' }[page]
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [booting, setBooting] = useState(true)
  const [page, setPage] = useState<Page>(readPage)
  const [pendingPath, setPendingPath] = useState('/reservations')
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    const onPopState = () => setPage(readPage())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    let alive = true
    getSession()
      .then((session) => {
        if (!alive) return

        if ('authenticated' in session) {
          setUser(null)

          if (window.location.pathname !== '/login') {
            setPendingPath(
              window.location.pathname === '/'
                ? '/reservations'
                : window.location.pathname
            )
            window.history.replaceState({}, '', '/login')
          }

          return
        }

        setUser(session)

        if (session.must_change_password) return

        if (window.location.pathname === '/login' || window.location.pathname === '/') {
          window.history.replaceState({}, '', '/reservations')
          setPage('week')
        }
      })
      .catch((error: unknown) => {
        if (!alive) return
        if (window.location.pathname !== '/login') {
          setPendingPath(window.location.pathname === '/' ? '/reservations' : window.location.pathname)
          window.history.replaceState({}, '', '/login')
        }
        if (error instanceof ApiError && error.status !== 401 && error.status !== 403) {
          setLoginError(error.message)
        }
      })
      .finally(() => alive && setBooting(false))
    return () => {
      alive = false
    }
  }, [])

  const navigate = useCallback((nextPage: Page) => {
    const target = routeFor(nextPage)
    if (window.location.pathname !== target) window.history.pushState({}, '', target)
    setPage(nextPage)
  }, [])

  async function handleLogin(username: string, password: string) {
    setLoginError('')
    try {
      const session = await login(username, password)
      setUser(session)
      if (session.must_change_password) {
        window.history.replaceState({}, '', '/login')
        return
      }
      const permittedPage: Page = pendingPath === '/reports' && !canSeeReport(session)
        ? 'week'
        : pendingPath === '/catalog' && !isManager(session)
          ? 'week'
          : pageFromPath(pendingPath)
      window.history.replaceState({}, '', routeFor(permittedPage))
      setPage(permittedPage)
    } catch (error) {
      setLoginError(getApiMessage(error))
    }
  }

  async function handlePasswordChanged(session: User) {
    setUser(session)
    const destination = pageFromPath(pendingPath)
    window.history.replaceState({}, '', routeFor(destination))
    setPage(destination)
  }

  async function handleLogout() {
    try {
      await logout()
    } finally {
      const protectedPath = window.location.pathname === '/login' ? pendingPath : window.location.pathname
      setPendingPath(protectedPath)
      window.history.replaceState({}, '', '/login')
      setUser(null)
      setLoginError('')
    }
  }

  if (booting) {
    return (
      <div
        className="grid min-h-svh place-items-center text-muted"
        aria-live="polite"
      >
        در حال بررسی نشست کاربری…
      </div>
    )
  }
  if (!user) {
    return <LoginScreen initialError={loginError} onSubmit={handleLogin} />
  }
  if (user.must_change_password) return <PasswordScreen onSuccess={handlePasswordChanged} />
  if (page === 'report' && !canSeeReport(user)) {
    window.history.replaceState({}, '', '/reservations')
    return <MainShell user={user} page="week" onNavigate={navigate} onLogout={handleLogout}><WeekPage /></MainShell>
  }
  if (page === 'catalog' && !isManager(user)) {
    window.history.replaceState({}, '', '/reservations')
    return <MainShell user={user} page="week" onNavigate={navigate} onLogout={handleLogout}><WeekPage /></MainShell>
  }

  return (
    <MainShell user={user} page={page} onNavigate={navigate} onLogout={handleLogout}>
      {page === 'week' && <WeekPage />}
      {page === 'history' && <HistoryPage />}
      {page === 'report' && <ReportPage />}
      {page === 'catalog' && <CatalogPage />}
    </MainShell>
  )
}

function pageFromPath(path: string): Page {
  if (path === '/history') return 'history'
  if (path === '/reports') return 'report'
  if (path === '/catalog' || path === '/menus') return 'catalog'
  return 'week'
}
