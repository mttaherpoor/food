import { useEffect, useState } from 'react'
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router'

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

function normalizePath(path: string): string {
  return path.replace(/\/+$/, '') || '/'
}

function pageFromPath(path: string): Page {
  const normalized = normalizePath(path)
  if (normalized === '/history') return 'history'
  if (normalized === '/reports') return 'report'
  if (normalized === '/catalog' || normalized === '/menus') return 'catalog'
  return 'week'
}

function routeFor(page: Page): string {
  return {
    week: '/reservations',
    history: '/history',
    report: '/reports',
    catalog: '/catalog',
  }[page]
}

function permittedPath(path: string, user: User): string {
  const page = pageFromPath(path)

  if (page === 'report' && !canSeeReport(user)) {
    return '/reservations'
  }

  if (page === 'catalog' && !isManager(user)) {
    return '/reservations'
  }

  return routeFor(page)
}

function loginDestination(path: string): string {
  const normalized = normalizePath(path)
  const destination =
    normalized === '/' || normalized === '/login'
      ? '/reservations'
      : normalized

  return `/login?next=${encodeURIComponent(destination)}`
}

function requestedDestination(fallback: string): string {
  const next = new URLSearchParams(window.location.search).get('next')

  if (
    next &&
    ['/reservations', '/history', '/reports', '/catalog', '/menus']
      .includes(normalizePath(next))
  ) {
    return normalizePath(next)
  }

  return fallback
}

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()

  const [user, setUser] = useState<User | null>(null)
  const [booting, setBooting] = useState(true)
  const [loginError, setLoginError] = useState('')

  const [pendingPath, setPendingPath] = useState(() => {
    const path = normalizePath(location.pathname)
    return path === '/' || path === '/login'
      ? '/reservations'
      : path
  })

  useEffect(() => {
    let alive = true

    getSession()
      .then((session) => {
        if (!alive) return

        if ('authenticated' in session) {
          setUser(null)

          if (normalizePath(window.location.pathname) !== '/login') {
            setPendingPath(
              normalizePath(window.location.pathname) === '/'
                ? '/reservations'
                : window.location.pathname
            )
            navigate(loginDestination(window.location.pathname), { replace: true })
          }

          return
        }

        setUser(session)

        if (session.must_change_password) return

        const path = normalizePath(window.location.pathname)

        if (path === '/login' || path === '/') {
          navigate(
            path === '/login'
              ? permittedPath(requestedDestination('/reservations'), session)
              : '/reservations',
            { replace: true }
          )
        }
      })
      .catch((error: unknown) => {
        if (!alive) return

        const path = normalizePath(window.location.pathname)

        if (path !== '/login') {
          setPendingPath(path === '/' ? '/reservations' : path)
          navigate(loginDestination(window.location.pathname), { replace: true })
        }

        if (
          error instanceof ApiError &&
          error.status !== 401 &&
          error.status !== 403
        ) {
          setLoginError(error.message)
        }
      })
      .finally(() => {
        if (alive) setBooting(false)
      })

    return () => {
      alive = false
    }
  }, [navigate])

  async function handleLogin(username: string, password: string) {
    setLoginError('')

    try {
      const session = await login(username, password)
      setUser(session)

      if (session.must_change_password) {
        navigate(loginDestination(requestedDestination(pendingPath)), {
          replace: true,
        })
        return
      }

      navigate(
        permittedPath(requestedDestination(pendingPath), session),
        { replace: true }
      )
    } catch (error) {
      setLoginError(getApiMessage(error))
    }
  }

  async function handlePasswordChanged(session: User) {
    setUser(session)

    navigate(
      permittedPath(requestedDestination(pendingPath), session),
      { replace: true }
    )
  }

  async function handleLogout() {
    try {
      await logout()
    } finally {
      const path = normalizePath(location.pathname)

      setPendingPath(
        path === '/login' ? pendingPath : path
      )
      setUser(null)
      setLoginError('')

      navigate(
        loginDestination(path === '/login' ? pendingPath : path),
        { replace: true }
      )
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
    return (
      <LoginScreen
        initialError={loginError}
        onSubmit={handleLogin}
      />
    )
  }

  if (user.must_change_password) {
    return <PasswordScreen onSuccess={handlePasswordChanged} />
  }

  const pathname = normalizePath(location.pathname)
  const currentPage = pageFromPath(pathname)

  if (pathname === '/login') {
    return (
      <Navigate
        to={permittedPath(requestedDestination(pendingPath), user)}
        replace
      />
    )
  }

  if (pathname === '/') {
    return <Navigate to="/reservations" replace />
  }

  if (
    pathname === '/reports' &&
    !canSeeReport(user)
  ) {
    return <Navigate to="/reservations" replace />
  }

  if (
    (pathname === '/catalog' || pathname === '/menus') &&
    !isManager(user)
  ) {
    return <Navigate to="/reservations" replace />
  }

  return (
    <MainShell
      user={user}
      page={currentPage}
      onNavigate={(page) => navigate(routeFor(page))}
      onLogout={handleLogout}
    >
      <Routes>
        <Route path="/reservations" element={<WeekPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route
          path="/reports"
          element={<ReportPage />}
        />
        <Route
          path="/catalog"
          element={<CatalogPage />}
        />
        <Route
          path="/menus"
          element={<Navigate to="/catalog" replace />}
        />
        <Route
          path="*"
          element={<Navigate to="/reservations" replace />}
        />
      </Routes>
    </MainShell>
  )
}
