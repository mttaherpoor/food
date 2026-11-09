import type { Page } from './app/navigation'
import { canSeeReport, isManager } from './app/permissions'
import BrandMark from './components/layout/BrandMark'
import MainShell from './components/layout/MainShell'
import { addDays, dateToIso, formatDate, getWeekStart } from './utils/date'
import { getApiMessage } from './utils/errors'
import { formatMoney } from './utils/format'
import { buttonClass, iconButtonClass, textButtonClass } from './components/ui/buttonStyles'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Utensils,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { api, apiClient, ApiError } from './api/client'
import {
  changePassword,
  getSession,
  login,
  logout,
} from './api/endpoints'
import type {
  CatalogItem,
  DailyReport,
  Reservation,
  User,
  WeeklyMenu,
} from './api/types'
import JalaliDatePicker, { jalaliMonthStartISO } from './components/ui/JalaliDatePicker'


type CatalogKind = 'foods' | 'sides' | 'drinks'

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

function LoginScreen({
  initialError,
  onSubmit,
}: {
  initialError: string
  onSubmit: (username: string, password: string) => Promise<void>
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(initialError)
  const [busy, setBusy] = useState(false)

  useEffect(() => setError(initialError), [initialError])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSubmit(username.trim(), password)
    } catch (submitError) {
      setError(getApiMessage(submitError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main dir="rtl" className="block min-h-svh min-[681px]:grid min-[681px]:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
      <section className="login-intro relative flex min-h-svh flex-col justify-between overflow-hidden bg-[#164c5a] p-[clamp(32px,6vw,88px)] text-white max-[680px]:min-h-0 max-[680px]:px-[22px] max-[680px]:pt-6 max-[680px]:pb-[25px]" aria-labelledby="login-title">
        <BrandMark variant="login" />
        <p className="mt-auto mb-[14px] font-semibold text-[#b9d6dc]">پی‌آی فود · سامانه کارکنان</p>
        <h1 id="login-title" className="m-0 max-w-[580px] text-[clamp(40px,5vw,66px)] leading-[1.22] tracking-[-1.6px] max-[680px]:mt-6 max-[680px]:max-w-[420px] max-[680px]:text-[32px]">غذای این هفته‌ات را انتخاب کن.</h1>
        <p className="mt-[22px] mb-0 max-w-[480px] text-lg leading-[1.9] text-[#d0e0e3] max-[680px]:mt-3 max-[680px]:text-sm">با کد پرسنلی وارد شو و رزروهای روزانه‌ات را مدیریت کن.</p>
        <div className="relative z-[1] mt-[72px] grid grid-cols-5 gap-2 max-[680px]:hidden" aria-hidden="true">
          <span className="rounded-[10px] border border-[#ffffff24] px-2 py-[14px] text-center text-[13px] text-[#d6e8eb] max-[680px]:px-[3px] max-[680px]:py-[9px] max-[680px]:text-[10px]">شنبه</span><span className="rounded-[10px] border border-[#ffffff24] px-2 py-[14px] text-center text-[13px] text-[#d6e8eb] max-[680px]:px-[3px] max-[680px]:py-[9px] max-[680px]:text-[10px]">یکشنبه</span><span className="rounded-[10px] border border-[#ffffff24] px-2 py-[14px] text-center text-[13px] text-[#d6e8eb] max-[680px]:px-[3px] max-[680px]:py-[9px] max-[680px]:text-[10px]">دوشنبه</span><span className="rounded-[10px] border border-[#ffffff24] px-2 py-[14px] text-center text-[13px] text-[#d6e8eb] max-[680px]:px-[3px] max-[680px]:py-[9px] max-[680px]:text-[10px]">سه‌شنبه</span><span className="rounded-[10px] border border-[#ffffff24] px-2 py-[14px] text-center text-[13px] text-[#d6e8eb] max-[680px]:px-[3px] max-[680px]:py-[9px] max-[680px]:text-[10px]">چهارشنبه</span>
          <strong className="col-span-full mt-[10px] font-medium text-[#e5f0f2] max-[680px]:mt-[5px] max-[680px]:text-xs">هر روز، یک منو</strong>
        </div>
      </section>
      <section className="grid place-items-center p-8 max-[680px]:px-[23px] max-[680px]:pt-[30px] max-[680px]:pb-11">
        <form className="flex w-full max-w-[430px] flex-col items-stretch" onSubmit={submit}>
          <h2 className="mb-[9px] text-[27px] tracking-[-0.5px] max-[680px]:text-[23px]">ورود به حساب</h2>
          <p className="mb-7 leading-[1.8] text-muted">برای ادامه، کد پرسنلی و رمز عبورت را وارد کن.</p>
          <label className="mb-[17px] flex flex-col gap-2 text-sm font-semibold text-[#34393c]" htmlFor="personnel-number">کد پرسنلی</label>
          <input className="mb-5 min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink"
            autoComplete="username"
            autoCapitalize="none"
            id="personnel-number"
            inputMode="numeric"
            maxLength={32}
            onChange={(event) => setUsername(event.target.value)}
            required
            value={username}
          />
          <label className="mb-[17px] flex flex-col gap-2 text-sm font-semibold text-[#34393c]" htmlFor="password">رمز عبور</label>
          <input className="mb-5 min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink"
            autoComplete="current-password"
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {error && <p className="mb-[15px] rounded-[9px] border border-[#f0c9cb] bg-[#fff4f4] px-[14px] py-3 text-sm leading-[1.7] text-[#8b242a]" role="alert">{error}</p>}
          <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[9px] border border-transparent bg-accent px-[14px] py-[9px] text-sm font-semibold text-white! cursor-pointer transition-colors duration-150 hover:not-disabled:bg-[#145769] disabled:cursor-not-allowed disabled:opacity-55" disabled={busy} type="submit">
            {busy ? 'در حال ورود…' : 'ورود'}
            {!busy && <ChevronLeft aria-hidden="true" size={18} />}
          </button>
          <p className="mt-[17px] text-center text-[13px] leading-[1.8] text-muted">ورود نخستین‌بار با رمز اولیه نیازمند تغییر رمز است.</p>
        </form>
      </section>
    </main>
  )
}

function PasswordScreen({ onSuccess }: { onSuccess: (session: User) => void }) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const session = await changePassword(oldPassword, newPassword, confirm)
      await onSuccess(session)
    } catch (submitError) {
      setError(getApiMessage(submitError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-[42px] p-7 max-[680px]:justify-start max-[680px]:gap-7 max-[680px]:px-[18px] max-[680px]:py-6">
      <BrandMark variant="default" />
      <form className="flex w-full max-w-[430px] flex-col items-stretch rounded-app border border-line bg-white p-8 max-[680px]:px-[18px] max-[680px]:py-[23px]" onSubmit={submit}>
        <h1 className="mb-[9px] text-[27px] tracking-[-0.5px]">یک رمز تازه انتخاب کن</h1>
        <p className="mb-7 leading-[1.8] text-muted">برای امنیت حساب، پیش از ادامه رمز اولیه را عوض کن.</p>
        <label className="mb-[17px] flex flex-col gap-2 text-sm font-semibold text-[#34393c]" htmlFor="old-password">رمز فعلی</label>
        <input className="mb-5 min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" autoComplete="current-password" id="old-password" onChange={(event) => setOldPassword(event.target.value)} required type="password" value={oldPassword} />
        <label className="mb-[17px] flex flex-col gap-2 text-sm font-semibold text-[#34393c]" htmlFor="new-password">رمز جدید</label>
        <input className="mb-5 min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" autoComplete="new-password" id="new-password" onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} />
        <label className="mb-[17px] flex flex-col gap-2 text-sm font-semibold text-[#34393c]" htmlFor="confirm-password">تکرار رمز جدید</label>
        <input className="mb-5 min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" autoComplete="new-password" id="confirm-password" onChange={(event) => setConfirm(event.target.value)} required type="password" value={confirm} />
        <p className="-mt-[5px] mb-[18px] text-xs leading-[1.8] text-muted">رمز باید شرایط امنیتی سامانه را داشته باشد و با کد پرسنلی برابر نباشد.</p>
        {error && <p className="mb-[15px] rounded-[9px] border border-[#f0c9cb] bg-[#fff4f4] px-[14px] py-3 text-sm leading-[1.7] text-[#8b242a]" role="alert">{error}</p>}
        <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[9px] border border-transparent bg-accent px-[14px] py-[9px] text-sm font-semibold text-white! cursor-pointer transition-colors duration-150 hover:not-disabled:bg-[#145769] disabled:cursor-not-allowed disabled:opacity-55" disabled={busy} type="submit">{busy ? 'در حال ذخیره…' : 'ذخیرهٔ رمز جدید'}</button>
      </form>
    </main>
  )
}

function WeekPage() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [menus, setMenus] = useState<WeeklyMenu[]>([])
  const [sides, setSides] = useState<CatalogItem[]>([])
  const [drinks, setDrinks] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState<WeeklyMenu | null>(null)
  const [filter, setFilter] = useState<'all' | 'reserved' | 'open'>('all')

  const startIso = dateToIso(weekStart)
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [weekMenus, sideItems, drinkItems] = await Promise.all([
        api<WeeklyMenu[]>(`/reservations/weekly?start=${startIso}`),
        api<CatalogItem[]>('/sides'),
        api<CatalogItem[]>('/drinks'),
      ])
      setMenus(weekMenus)
      setSides(sideItems)
      setDrinks(drinkItems)
    } catch (loadError) {
      setError(getApiMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [startIso])

  useEffect(() => { void load() }, [load])

  const days = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const date = dateToIso(addDays(weekStart, index))
    return { date, menu: menus.find((menu) => menu.date === date) ?? null }
  }), [menus, weekStart])
  const reservationCount = days.filter(({ menu }) => menu?.reservation?.status === 'res').length
  const visibleDays = days.filter(({ menu }) => {
    if (filter === 'reserved') return menu?.reservation?.status === 'res'
    if (filter === 'open') return menu && menu.can_reserve && menu.reservation?.status !== 'res'
    return true
  })

  return (
    <section className="min-w-0" aria-labelledby="week-title">
      <div className="mb-[25px] flex items-end justify-between gap-[18px] max-[680px]:mb-[18px] max-[680px]:items-start [&_h1]:m-0 [&_h1]:text-[clamp(26px,3vw,34px)] [&_h1]:leading-[1.35] [&_h1]:tracking-[-0.8px] max-[680px]:[&_h1]:text-[27px]">
        <div>
          <p className="mt-0 mb-2 text-xs font-bold text-accent">برنامهٔ هفتگی</p>
          <h1 id="week-title">غذای هفته</h1>
          <p className="mt-[7px] mb-0 text-sm leading-[1.7] text-muted max-[680px]:max-w-[440px] max-[680px]:text-xs">هر روز یک غذا برای انتخاب؛ ساید و نوشیدنی اختیاری است.</p>
        </div>
        <button
          aria-label="تازه‌سازی برنامه هفتگی"
          className={buttonClass('secondary', 'shrink-0 max-[680px]:h-[39px] max-[680px]:min-h-[39px] max-[680px]:w-[39px] max-[680px]:min-w-[39px] max-[680px]:gap-0 max-[680px]:p-0')}
          onClick={() => void load()}
          type="button"
        >
          <RefreshCw aria-hidden="true" className="shrink-0" size={16} />
          <span className="max-[680px]:hidden">تازه‌سازی</span>
        </button>
      </div>

      <div className="flex min-h-[58px] items-center justify-between gap-[14px] border-y border-line py-2 max-[680px]:flex-col-reverse max-[680px]:items-start max-[680px]:gap-[5px] max-[680px]:py-[10px]">
        <div className="flex items-center gap-[9px] max-[680px]:w-full max-[680px]:justify-between max-[680px]:gap-[3px]">
          <button aria-label="هفتهٔ بعد" className={`${iconButtonClass} max-[680px]:h-[34px] max-[680px]:w-[34px]`} onClick={() => setWeekStart((value) => addDays(value, 7))} type="button"><ChevronRight size={18} /></button>
          <strong className="whitespace-nowrap text-sm max-[680px]:text-xs">{formatDate(startIso, { weekday: undefined })} <span className="mx-1 font-normal text-[#899094]">تا</span> {formatDate(dateToIso(addDays(weekStart, 5)), { weekday: undefined })}</strong>
          <button aria-label="هفتهٔ قبل" className={`${iconButtonClass} max-[680px]:h-[34px] max-[680px]:w-[34px]`} onClick={() => setWeekStart((value) => addDays(value, -7))} type="button"><ChevronLeft size={18} /></button>
          <button className={`${textButtonClass} text-accent!`} onClick={() => setWeekStart(getWeekStart(new Date()))} type="button">برو به هفته جاری</button>
        </div>
        <div className="flex items-baseline gap-[7px] text-xs text-muted max-[680px]:self-start"><strong className="text-xl text-accent">{new Intl.NumberFormat('fa-IR').format(reservationCount)}</strong><span>رزرو فعال</span></div>
      </div>

      <div className="my-3 mt-[18px] flex flex-wrap gap-[7px] max-[680px]:my-2 max-[680px]:mt-[13px] max-[680px]:flex-nowrap max-[680px]:overflow-x-auto max-[680px]:pb-[3px]" role="group" aria-label="فیلتر روزها">
        {([
          ['all', 'همهٔ روزها'], ['reserved', 'رزروهای من'], ['open', 'رزرو نشده'],
        ] as const).map(([key, label]) => <button aria-pressed={filter === key} className={`inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center rounded-full border px-3 py-[7px] text-xs transition-colors duration-150 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#63a5b4] ${filter === key ? 'border-[#a8ccd4] bg-accent-soft font-semibold text-[#155c6c]' : 'border-line bg-white font-normal text-[#596166] hover:bg-raised hover:text-ink'}`} key={key} onClick={() => setFilter(key)} type="button">{label}</button>)}
      </div>

      {error && <ErrorMessage message={error} onRetry={() => void load()} />}
      {loading ? <LoadingRows /> : visibleDays.length === 0 ? <EmptyState title="روزی با این فیلتر پیدا نشد" detail="فیلتر دیگری را انتخاب کن." /> : (
        <div className="border-t border-line">
          {visibleDays.map(({ date, menu }, index) => (
            <DayRow
              date={date}
              index={index}
              key={date}
              menu={menu}
              onEdit={() => menu && setEditor(menu)}
            />
          ))}
        </div>
      )}

      {editor && <ReservationDialog drinks={drinks} menu={editor} onClose={() => setEditor(null)} onSaved={load} sides={sides} />}
    </section>
  )
}

function DayRow({ date, index, menu, onEdit }: { date: string; index: number; menu: WeeklyMenu | null; onEdit: () => void }) {
  const today = dateToIso(new Date()) === date
  const reservation = menu?.reservation ?? null
  const activeReservation = reservation?.status === 'res'

  return (
    <article className={`grid min-h-[84px] grid-cols-[minmax(120px,0.8fr)_minmax(190px,1.55fr)_minmax(100px,0.7fr)_minmax(120px,auto)] items-center gap-[18px] border-b border-line px-1 py-[13px] max-[900px]:grid-cols-[minmax(105px,0.7fr)_minmax(160px,1.3fr)_minmax(85px,0.6fr)_auto] max-[900px]:gap-[10px] max-[680px]:grid-cols-[minmax(0,1fr)_auto] max-[680px]:gap-x-3 max-[680px]:gap-y-2 max-[680px]:px-[2px] max-[680px]:py-[14px] ${today ? "relative before:absolute before:inset-y-[15px] before:start-[-10px] before:w-[3px] before:rounded-[3px] before:bg-accent before:content-['']" : ""}${index > 4 ? " weekend" : ""}`}>
      <div className="flex min-w-0 flex-col gap-1 max-[680px]:col-start-1 max-[680px]:row-start-1 max-[680px]:flex-row max-[680px]:flex-wrap max-[680px]:items-baseline max-[680px]:gap-x-2">
        <strong className="text-sm max-[680px]:text-[13px]">{formatDate(date, { weekday: 'long' })}</strong>
        <span className="text-xs text-muted max-[680px]:text-[11px]">{formatDate(date, { weekday: undefined, month: 'short' })}</span>
        {today && <span className="mt-[2px] self-start text-[11px] font-semibold text-accent max-[680px]:mt-0">امروز</span>}
      </div>
      <div className="flex min-w-0 flex-col gap-1 max-[680px]:col-start-1 max-[680px]:row-start-2">
        {menu ? <>
          <strong className="truncate text-sm max-[680px]:text-[13px]">{menu.food_name}</strong>
          <span className="text-xs text-muted">{formatMoney(menu.food_price)}</span>
        </> : <><strong className="truncate text-sm text-[#899094] max-[680px]:text-[13px]">منویی ثبت نشده</strong><span className="text-xs text-muted">برای این روز هنوز غذایی در برنامه نیست.</span></>}
      </div>
      <div className="flex items-center gap-2 whitespace-nowrap text-xs text-[#555d61] max-[680px]:col-start-2 max-[680px]:row-start-1 max-[680px]:justify-self-end max-[680px]:text-[11px]">
        {activeReservation ? <>
          <span className="h-2 w-2 rounded-full bg-positive" />
          <span>رزرو شده</span>
        </> : reservation?.status === 'can' ? <>
          <span className="h-2 w-2 rounded-full bg-[#92999d]" />
          <span>لغو شده</span>
        </> : menu ? <>
          <span className="h-2 w-2 rounded-full bg-[#d49b38]" />
          <span>{menu.can_reserve ? 'رزرو نشده' : 'مهلت گذشته'}</span>
        </> : <span className="text-[#899094]">—</span>}
      </div>
      <div className="day-action flex justify-start max-[680px]:col-start-2 max-[680px]:row-start-2 max-[680px]:self-center">
        {menu && (activeReservation
          ? menu.can_reserve
            ? <button className={buttonClass('secondary', '', 'day')} onClick={onEdit} type="button">ویرایش / لغو</button>
            : <button className={buttonClass('disabled', '', 'day')} disabled type="button">مهلت تمام شده</button>
          : menu.can_reserve
            ? <button className={buttonClass('primary', '', 'day')} onClick={onEdit} type="button"><Plus size={16} /> {reservation?.status === 'can' ? 'رزرو مجدد' : 'انتخاب غذا'}</button>
            : <button className={buttonClass('disabled', '', 'day')} disabled type="button">مهلت تمام شده</button>)}
      </div>
    </article>
  )
}

function ReservationDialog({
  menu,
  sides,
  drinks,
  onClose,
  onSaved,
}: {
  menu: WeeklyMenu
  sides: CatalogItem[]
  drinks: CatalogItem[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const current = menu.reservation?.current_item
  const [side, setSide] = useState(current?.side?.toString() ?? '')
  const [drink, setDrink] = useState(current?.drink?.toString() ?? '')
  const [foodQuantity, setFoodQuantity] = useState(current?.food_quantity ?? 1)
  const [sideQuantity, setSideQuantity] = useState(current?.side_quantity ?? 1)
  const [drinkQuantity, setDrinkQuantity] = useState(current?.drink_quantity ?? 1)
  const [saving, setSaving] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const dialogRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'

    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ')

    function getFocusableElements(): HTMLElement[] {
      if (!dialog) return []

      return Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.getClientRects().length > 0)
    }

    // Focus the explicit close control on initial opening.
    const closeButton = dialog.querySelector<HTMLButtonElement>(
      'button[aria-label="بستن"]',
    )

    ;(closeButton ?? dialog).focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (!dialog) return

      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return

      const elements = getFocusableElements()
      const first = elements[0]
      const last = elements[elements.length - 1]

      if (!first || !last) {
        event.preventDefault()
        dialog.focus()
        return
      }

      if (!dialog.contains(document.activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
        return
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow

      if (
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected
      ) {
        previousFocus.focus()
      }
    }
  }, [])

  const total = menu.food_price * foodQuantity
    + (sides.find((item) => item.id === Number(side))?.price ?? 0) * (side ? sideQuantity : 0)
    + (drinks.find((item) => item.id === Number(drink))?.price ?? 0) * (drink ? drinkQuantity : 0)

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const item = {
      food_quantity: foodQuantity,
      side: side ? Number(side) : null,
      ...(side ? { side_quantity: sideQuantity } : {}),
      drink: drink ? Number(drink) : null,
      ...(drink ? { drink_quantity: drinkQuantity } : {}),
    }
    try {
      if (menu.reservation) {
        await api<Reservation>(`/reservations/${menu.reservation.id}`, { method: 'PATCH', body: JSON.stringify(item) })
      } else {
        await api<Reservation[]>('/reservations', { method: 'POST', body: JSON.stringify({ reservations: [{ menu: menu.id, ...item }] }) })
      }
      await onSaved()
      setSaved(true)
    } catch (saveError) {
      setError(getApiMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  async function cancelReservation() {
    if (!menu.reservation) return
    setCanceling(true)
    setError('')
    try {
      await api<Reservation>(`/reservations/${menu.reservation.id}/cancel`, { method: 'POST', body: '{}' })
      await onSaved()
      setCancelled(true)
    } catch (cancelError) {
      setError(getApiMessage(cancelError))
    } finally {
      setCanceling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-10 grid place-items-center overflow-y-auto bg-[#10232b80] p-5" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-labelledby="reservation-dialog-title" aria-modal="true" className="w-full max-w-[480px] max-h-[min(90svh,760px)] overflow-y-auto rounded-2xl border border-white/50 bg-white p-[22px] shadow-[0_20px_70px_#09252d33] max-[680px]:max-h-[88svh] max-[680px]:self-end max-[680px]:rounded-t-2xl max-[680px]:rounded-b-[10px] max-[680px]:p-[19px]" ref={dialogRef} tabIndex={-1} role="dialog">
        <div className="flex items-start justify-between gap-3 border-b border-line pb-[17px]">
          <div><p className="mt-0 mb-[3px] text-xs font-bold text-accent">{formatDate(menu.date)}</p><h2 className="m-0 text-xl" id="reservation-dialog-title">{saved ? 'رزرو ثبت شد' : cancelled ? 'رزرو لغو شد' : menu.food_name}</h2></div>
          <button aria-label="بستن" className={iconButtonClass} onClick={onClose} type="button"><X size={19} /></button>
        </div>
        {saved || cancelled ? <div className="rounded-[9px] border border-[#c9e5d7] bg-[#f0faf4] p-[14px] leading-[1.8] text-[#176441]" role="status">{saved ? 'انتخابت برای این روز ثبت شد.' : 'رزرو این روز لغو شد و در سوابق باقی ماند.'}</div> : <form className="grid gap-[11px] pt-4" onSubmit={save}>
          <p className="m-0 flex justify-between gap-[10px] py-[11px] text-[13px] text-muted">غذای روز <strong className="text-ink">{formatMoney(menu.food_price)}</strong></p>
          <QuantityField label="تعداد غذا" value={foodQuantity} onChange={setFoodQuantity} />
          <CatalogSelect label="ساید (اختیاری)" value={side} options={sides} onChange={setSide} />
          {side && <QuantityField label="تعداد ساید" value={sideQuantity} onChange={setSideQuantity} />}
          <CatalogSelect label="نوشیدنی (اختیاری)" value={drink} options={drinks} onChange={setDrink} />
          {drink && <QuantityField label="تعداد نوشیدنی" value={drinkQuantity} onChange={setDrinkQuantity} />}
          <div className="mt-1 flex justify-between gap-[10px] border-t border-line py-[11px] text-sm text-muted"><span>جمع این انتخاب</span><strong className="text-ink">{formatMoney(total)}</strong></div>
          {error && <p className="mb-[15px] rounded-[9px] border border-[#f0c9cb] bg-[#fff4f4] px-[14px] py-3 text-sm leading-[1.7] text-[#8b242a]" role="alert">{error}</p>}
          <button className={buttonClass('primary', 'w-full')} disabled={saving || canceling} type="submit">{saving ? 'در حال ثبت…' : menu.reservation?.status === 'can' ? 'ثبت رزرو مجدد' : menu.reservation ? 'ذخیرهٔ ویرایش' : 'ثبت رزرو'}</button>
          {menu.reservation?.status === 'res' && <button className={buttonClass('dangerQuiet', '')} disabled={saving || canceling} onClick={() => void cancelReservation()} type="button">{canceling ? 'در حال لغو…' : 'لغو غذای این روز'}</button>}
          <p className="mt-px mb-0 text-center text-[11px] text-muted">مهلت رزرو و ویرایش تا ساعت ۱۰ صبح روز قبل است.</p>
        </form>}
      </section>
    </div>
  )
}

function CatalogSelect({ label, value, options, onChange }: { label: string; value: string; options: CatalogItem[]; onChange: (value: string) => void }) {
  return (
    <label className="m-0 flex flex-col gap-2 text-sm font-semibold text-[#34393c]">
      {label}
      <select
        className="min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">انتخاب نکن</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} · {formatMoney(item.price)}
          </option>
        ))}
      </select>
    </label>
  )
}

function QuantityField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="m-0 flex max-w-40 flex-col gap-2 text-sm font-semibold text-[#34393c]">
      {label}
      <input
        className="min-h-10 w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink"
        min={1}
        onChange={(event) => onChange(Math.max(1, Number(event.target.value)))}
        type="number"
        value={value}
      />
    </label>
  )
}

function HistoryPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Reservation[]>('/reservations')
      .then(setReservations)
      .catch((loadError: unknown) => setError(getApiMessage(loadError)))
      .finally(() => setLoading(false))
  }, [])

  return <section className="min-w-0" aria-labelledby="history-title">
    <div className="mb-[25px] flex items-end justify-between gap-[18px] max-[680px]:mb-[18px] max-[680px]:items-start [&_h1]:m-0 [&_h1]:text-[clamp(26px,3vw,34px)] [&_h1]:leading-[1.35] [&_h1]:tracking-[-0.8px] max-[680px]:[&_h1]:text-[27px]"><div><p className="mt-0 mb-2 text-xs font-bold text-accent">حساب من</p><h1 id="history-title">سوابق رزرو</h1><p className="mt-[7px] mb-0 text-sm leading-[1.7] text-muted max-[680px]:max-w-[440px] max-[680px]:text-xs">رزروها و نسخه‌های ویرایش‌شدهٔ قبلی در اینجا می‌مانند.</p></div></div>
    {error && <ErrorMessage message={error} />}
    {loading ? <LoadingRows /> : reservations.length === 0 ? <EmptyState title="هنوز رزروی ثبت نکرده‌ای" detail="از صفحهٔ رزرو هفته می‌توانی غذای روزها را انتخاب کنی." /> : <div className="border-t border-line">
      {reservations.map((reservation) => <article className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-3 border-b border-line px-[5px] py-[19px] max-[680px]:gap-[10px]" key={reservation.id}>
        <div className="flex flex-wrap items-center gap-x-[15px] gap-y-[9px] max-[680px]:gap-x-[10px] max-[680px]:gap-y-[7px]"><span className="text-xs text-muted max-[680px]:order-0">{formatDate(reservation.menu_date)}</span><strong className="text-sm max-[680px]:order-1 max-[680px]:w-full">{reservation.food_name}</strong><span className={`text-xs max-[680px]:order-2 ${reservation.status === 'res' ? 'text-positive' : 'text-muted'}`}>{reservation.status === 'res' ? 'رزرو فعال' : 'لغو شده'}</span></div>
        <div className="self-center whitespace-nowrap text-[13px] font-semibold max-[680px]:self-start max-[680px]:text-xs">{formatMoney(reservation.total_price)}</div>
        <details className="col-span-full text-xs text-muted"><summary className="w-fit cursor-pointer">{new Intl.NumberFormat('fa-IR').format(reservation.history.length)} نسخهٔ ثبت‌شده</summary><ol className="mt-3 grid gap-2 ps-[22px]">{reservation.history.map((item) => <li className="grid grid-cols-[1fr_1fr_auto] gap-[10px] border-t border-line py-[9px] max-[680px]:grid-cols-[1fr_auto]" key={item.id}><span>{new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.datetime_created ?? Date.now()))}</span><span className="max-[680px]:col-start-1">{item.is_cancelled ? 'لغو رزرو' : [item.side_name, item.drink_name].filter(Boolean).join('، ') || 'بدون ساید و نوشیدنی'}</span><strong className="text-ink max-[680px]:col-start-2 max-[680px]:row-[1/3] max-[680px]:self-center">{formatMoney(item.total_price)}</strong></li>)}</ol></details>
      </article>)}
    </div>}
  </section>
}

function ReportPage() {
  const today = dateToIso(new Date())
  const firstDay = jalaliMonthStartISO(today)
  const [fromDate, setFromDate] = useState(firstDay)
  const [toDate, setToDate] = useState(today)
  const [rows, setRows] = useState<DailyReport[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const total = rows.reduce((sum, row) => sum + row.total_toman, 0)
  const reserved = rows.reduce((sum, row) => sum + row.reserved_count, 0)

  async function loadReport(event?: FormEvent) {
    event?.preventDefault()
    setLoading(true)
    setError('')
    try {
      setRows(await api<DailyReport[]>(`/reports/daily?from=${fromDate}&to=${toDate}`))
      setLoaded(true)
    } catch (loadError) {
      setError(getApiMessage(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadReport() }, [])

  async function downloadReport() {
    setError('')
    try {
      const response = await apiClient.get<Blob>(
        '/reports/daily/export',
        {
          params: { from: fromDate, to: toDate },
          responseType: 'blob',
        },
      )
      const blob = response.data
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'food-daily-report-jalali.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (downloadError) { setError(getApiMessage(downloadError)) }
  }

  return <section className="min-w-0" aria-labelledby="report-title">
    <div className="mb-[25px] flex items-end justify-between gap-[18px] max-[680px]:mb-[18px] max-[680px]:items-start [&_h1]:m-0 [&_h1]:text-[clamp(26px,3vw,34px)] [&_h1]:leading-[1.35] [&_h1]:tracking-[-0.8px] max-[680px]:[&_h1]:text-[27px]"><div><p className="mt-0 mb-2 text-xs font-bold text-accent">گزارش مدیریتی</p><h1 id="report-title">گزارش روزانهٔ رزرو</h1><p className="mt-[7px] mb-0 text-sm leading-[1.7] text-muted max-[680px]:max-w-[440px] max-[680px]:text-xs">تعداد غذا و مبلغ رزروهای فعال را بر اساس تاریخ ببین.</p></div></div>
    <form className="flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-line bg-white p-[17px] max-[680px]:flex-col max-[680px]:items-stretch" onSubmit={(event) => void loadReport(event)}>
      <label className="flex flex-col gap-2 mb-[17px] text-sm font-semibold text-[#34393c] !m-0 min-w-[180px] max-[680px]:min-w-0">از تاریخ<JalaliDatePicker onChange={setFromDate} required value={fromDate} /></label>
      <label className="flex flex-col gap-2 mb-[17px] text-sm font-semibold text-[#34393c] !m-0 min-w-[180px] max-[680px]:min-w-0">تا تاریخ<JalaliDatePicker onChange={setToDate} required value={toDate} /></label>
      <button className={buttonClass('primary', '')} disabled={loading} type="submit">{loading ? 'در حال دریافت…' : 'نمایش گزارش'}</button>
      <button className={buttonClass('neutral', '')} onClick={() => void downloadReport()} type="button">خروجی Excel (شمسی)</button>
    </form>
    {error && <ErrorMessage message={error} onRetry={() => void loadReport()} />}
    {loaded && !error && <>
      <div className="my-[18px] grid grid-cols-2 gap-[13px] max-[680px]:gap-2">
        <div className="grid gap-[5px] rounded-[11px] border border-line bg-white p-[17px] max-[680px]:p-3">
          <span className="text-xs text-muted">رزرو فعال در این بازه</span>
          <strong className="text-[23px] max-[680px]:text-[17px]">{new Intl.NumberFormat('fa-IR').format(reserved)}</strong>
        </div>
        <div className="grid gap-[5px] rounded-[11px] border border-line bg-white p-[17px] max-[680px]:p-3">
          <span className="text-xs text-muted">جمع مبالغ</span>
          <strong className="text-[23px] max-[680px]:text-[17px]">{formatMoney(total)}</strong>
        </div>
      </div>
      {rows.length === 0 ? <EmptyState title="برای این بازه منویی ثبت نشده" detail="تاریخ دیگری را انتخاب کن." /> : <div className="max-w-full overflow-x-auto rounded-[10px] border border-line bg-white"><table className="w-full min-w-[680px] border-collapse text-right text-[13px] whitespace-nowrap [&_th]:border-b [&_th]:border-line [&_th]:bg-raised [&_th]:px-[14px] [&_th]:py-[13px] [&_th]:font-semibold [&_th]:text-[#5a6266] [&_td]:border-b [&_td]:border-line [&_td]:px-[14px] [&_td]:py-[13px]"><thead><tr><th>تاریخ</th><th>غذا</th><th>رزرو</th><th>لغو</th><th>تعداد غذا</th><th>جمع (تومان)</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.date}-${row.food}`}><td>{formatDate(row.date)}</td><td>{row.food}</td><td>{new Intl.NumberFormat('fa-IR').format(row.reserved_count)}</td><td>{new Intl.NumberFormat('fa-IR').format(row.cancelled_count)}</td><td>{new Intl.NumberFormat('fa-IR').format(row.food_quantity)}</td><td>{new Intl.NumberFormat('fa-IR').format(row.total_toman)}</td></tr>)}</tbody></table></div>}
    </>}
  </section>
}

function CatalogPage() {
  const [foods, setFoods] = useState<(CatalogItem & { container_price: number; total_price: number })[]>([])
  const [sides, setSides] = useState<CatalogItem[]>([])
  const [drinks, setDrinks] = useState<CatalogItem[]>([])
  const [foodName, setFoodName] = useState('')
  const [foodPrice, setFoodPrice] = useState('')
  const [containerPrice, setContainerPrice] = useState('')
  const [menuDate, setMenuDate] = useState(dateToIso(addDays(new Date(), 1)))
  const [selectedFood, setSelectedFood] = useState('')
  const [kind, setKind] = useState<CatalogKind>('sides')
  const [itemName, setItemName] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [foodRows, sideRows, drinkRows] = await Promise.all([
        api<(CatalogItem & { container_price: number; total_price: number })[]>('/foods'),
        api<CatalogItem[]>('/sides'),
        api<CatalogItem[]>('/drinks'),
      ])
      setFoods(foodRows)
      setSides(sideRows)
      setDrinks(drinkRows)
      setSelectedFood((value) => value || foodRows[0]?.id.toString() || '')
    } catch (loadError) {
      setError(getApiMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadCatalog() }, [loadCatalog])

  async function createFood(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    try {
      const created = await api<CatalogItem & { container_price: number }>('/foods', {
        method: 'POST', body: JSON.stringify({ name: foodName.trim(), price: Number(foodPrice), container_price: Number(containerPrice) }),
      })
      setFoodName(''); setFoodPrice(''); setContainerPrice(''); setNotice('غذا به کاتالوگ اضافه شد.')
      await loadCatalog()
      setSelectedFood(created.id.toString())
    } catch (saveError) { setError(getApiMessage(saveError)) }
  }

  async function createCatalogItem(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    const endpoint = kind === 'sides' ? '/sides' : '/drinks'
    try {
      await api(endpoint, { method: 'POST', body: JSON.stringify({ name: itemName.trim(), price: Number(itemPrice) }) })
      setItemName(''); setItemPrice(''); setNotice(kind === 'sides' ? 'ساید اضافه شد.' : 'نوشیدنی اضافه شد.')
      await loadCatalog()
    } catch (saveError) { setError(getApiMessage(saveError)) }
  }

  async function createMenu(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    try {
      await api('/menus', { method: 'POST', body: JSON.stringify({ date: menuDate, food: Number(selectedFood) }) })
      setNotice('منوی این روز ثبت شد.')
    } catch (saveError) { setError(getApiMessage(saveError)) }
  }

  return <section className="min-w-0" aria-labelledby="catalog-title">
    <div className="mb-[25px] flex items-end justify-between gap-[18px] max-[680px]:mb-[18px] max-[680px]:items-start [&_h1]:m-0 [&_h1]:text-[clamp(26px,3vw,34px)] [&_h1]:leading-[1.35] [&_h1]:tracking-[-0.8px] max-[680px]:[&_h1]:text-[27px]"><div><p className="mt-0 mb-2 text-xs font-bold text-accent">ویژهٔ HR</p><h1 id="catalog-title">مدیریت منو</h1><p className="mt-[7px] mb-0 text-sm leading-[1.7] text-muted max-[680px]:max-w-[440px] max-[680px]:text-xs">غذاها و گزینه‌های جانبی را مدیریت و منوی روز را تعیین کن.</p></div><button aria-label="تازه‌سازی کاتالوگ" className={iconButtonClass} onClick={() => void loadCatalog()} type="button"><RefreshCw size={18} /></button></div>
    {notice && <p className="mb-[14px] rounded-[9px] border border-[#c9e5d7] bg-[#f0faf4] p-[14px] leading-[1.8] text-[#176441]" role="status">{notice}</p>}
    {error && <ErrorMessage message={error} />}
    {loading ? <LoadingRows /> : <div className="grid grid-cols-2 gap-[15px] max-[680px]:grid-cols-1">
      <section className="min-w-0 rounded-xl border border-line bg-white p-[18px]"><h2 className="mt-0 mb-[15px] text-base">افزودن غذا</h2><form className="grid grid-cols-2 gap-3" onSubmit={(event) => void createFood(event)}><label className="flex flex-col gap-2 mb-[17px] text-sm font-semibold text-[#34393c] !m-0 col-span-full">نام غذا<input className="min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" onChange={(event) => setFoodName(event.target.value)} required value={foodName} /></label><label className="flex flex-col gap-2 mb-[17px] text-sm font-semibold text-[#34393c] !m-0">قیمت غذا (تومان)<input className="min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" min={0} onChange={(event) => setFoodPrice(event.target.value)} required type="number" value={foodPrice} /></label><label className="flex flex-col gap-2 mb-[17px] text-sm font-semibold text-[#34393c] !m-0">قیمت ظرف (تومان)<input className="min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" min={0} onChange={(event) => setContainerPrice(event.target.value)} required type="number" value={containerPrice} /></label><button className={buttonClass('primary', 'col-span-full')} type="submit">افزودن غذا</button></form></section>
      <section className="min-w-0 rounded-xl border border-line bg-white p-[18px]"><h2 className="mt-0 mb-[15px] text-base">ثبت منوی روز</h2><form className="grid gap-3" onSubmit={(event) => void createMenu(event)}><label className="flex flex-col gap-2 mb-[17px] text-sm font-semibold text-[#34393c] !m-0">تاریخ<JalaliDatePicker onChange={setMenuDate} required value={menuDate} /></label><label className="flex flex-col gap-2 mb-[17px] text-sm font-semibold text-[#34393c] !m-0">غذای روز<select className="min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" onChange={(event) => setSelectedFood(event.target.value)} required value={selectedFood}>{foods.map((food) => <option key={food.id} value={food.id}>{food.name} · {formatMoney(food.total_price)}</option>)}</select></label><button className={buttonClass('primary', '')} disabled={!foods.length} type="submit">ثبت منو</button></form></section>
      <section className="min-w-0 rounded-xl border border-line bg-white p-[18px]"><h2 className="mt-0 mb-[15px] text-base">افزودن گزینهٔ جانبی</h2><form className="grid grid-cols-2 gap-3" onSubmit={(event) => void createCatalogItem(event)}><label className="flex flex-col gap-2 mb-[17px] text-sm font-semibold text-[#34393c] !m-0">نوع گزینه<select className="min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" onChange={(event) => setKind(event.target.value as CatalogKind)} value={kind}><option value="sides">ساید</option><option value="drinks">نوشیدنی</option></select></label><label className="flex flex-col gap-2 mb-[17px] text-sm font-semibold text-[#34393c] !m-0">نام<input className="min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" onChange={(event) => setItemName(event.target.value)} required value={itemName} /></label><label className="flex flex-col gap-2 mb-[17px] text-sm font-semibold text-[#34393c] !m-0 col-span-full">قیمت (تومان)<input className="min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" min={0} onChange={(event) => setItemPrice(event.target.value)} required type="number" value={itemPrice} /></label><button className={buttonClass('primary', 'col-span-full')} type="submit">افزودن گزینه</button></form></section>
      <CatalogSummary foods={foods} sides={sides} drinks={drinks} />
    </div>}
  </section>
}

function CatalogSummary({ foods, sides, drinks }: { foods: CatalogItem[]; sides: CatalogItem[]; drinks: CatalogItem[] }) {
  return (
    <section
      aria-label="کاتالوگ موجود"
      className="col-span-full flex min-w-0 items-center justify-between gap-[18px] rounded-xl border border-line bg-white p-[18px] max-[680px]:col-auto max-[680px]:flex-col max-[680px]:items-start"
    >
      <h2 className="m-0 text-base">کاتالوگ موجود</h2>
      <div className="flex flex-wrap gap-[18px] text-[13px] text-muted max-[680px]:gap-3">
        <span>غذا <strong className="ms-[5px] text-ink">{foods.length}</strong></span>
        <span>ساید <strong className="ms-[5px] text-ink">{sides.length}</strong></span>
        <span>نوشیدنی <strong className="ms-[5px] text-ink">{drinks.length}</strong></span>
      </div>
    </section>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid justify-items-center px-[18px] py-[54px] text-center text-muted">
      <span
        aria-hidden="true"
        className="grid h-[46px] w-[46px] place-items-center rounded-[14px] bg-accent-soft text-accent"
      >
        <Utensils size={20} />
      </span>
      <h2 className="mt-[15px] mb-[5px] text-[17px] text-ink">{title}</h2>
      <p className="m-0 text-[13px] leading-[1.8]">{detail}</p>
    </div>
  )
}

function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="my-3 flex items-center justify-between gap-3 rounded-[9px] border border-[#f0c9cb] bg-[#fff4f4] px-[14px] py-3 text-sm leading-[1.7] text-[#8b242a]" role="alert"><span>{message}</span>{onRetry && <button className={textButtonClass} onClick={onRetry} type="button">تلاش دوباره</button>}</div>
}

function LoadingRows() {
  return (
    <div
      aria-label="در حال بارگذاری"
      aria-live="polite"
      className="mt-[15px] grid gap-px"
    >
      {[0, 1, 2].map((index) => (
        <span
          aria-hidden="true"
          className="loading-shimmer h-[73px] border-b border-line"
          key={index}
        />
      ))}
    </div>
  )
}
