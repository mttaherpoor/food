import {
  CalendarDays,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LogOut,
  Plus,
  RefreshCw,
  Utensils,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import {
  api,
  ApiError,
  changePassword,
  getSession,
  login,
  logout,
} from './api'
import type { CatalogItem, DailyReport, Reservation, User, WeeklyMenu } from './api'

type Page = 'week' | 'history' | 'report' | 'catalog'
type CatalogKind = 'foods' | 'sides' | 'drinks'

const navItems: { key: Page; label: string; icon: typeof CalendarDays }[] = [
  { key: 'week', label: 'رزرو هفته', icon: CalendarDays },
  { key: 'history', label: 'سوابق من', icon: ClipboardList },
]

function isManager(user: User) {
  return user.is_superuser || user.roles.includes('hrFood')
}

function canSeeReport(user: User) {
  return isManager(user) || user.roles.includes('Viewer')
}

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

function formatMoney(amount: number) {
  return `${new Intl.NumberFormat('fa-IR').format(amount)} تومان`
}

function formatDate(date: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...options,
  }).format(new Date(`${date}T12:00:00`))
}

function dateToIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getWeekStart(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

function addDays(date: Date, count: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + count)
  return result
}

function getApiMessage(error: unknown) {
  return error instanceof Error ? error.message : 'خطایی رخ داد. دوباره تلاش کنید.'
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

  if (booting) return <div className="boot-screen" aria-live="polite">در حال بررسی نشست کاربری…</div>
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
    <main className="login-layout">
      <section className="login-intro" aria-labelledby="login-title">
        <BrandMark />
        <p className="intro-line">پی‌آی فود · سامانه کارکنان</p>
        <h1 id="login-title">غذای این هفته‌ات را انتخاب کن.</h1>
        <p>با کد پرسنلی وارد شو و رزروهای روزانه‌ات را مدیریت کن.</p>
        <div className="intro-week" aria-hidden="true">
          <span>شنبه</span><span>یکشنبه</span><span>دوشنبه</span><span>سه‌شنبه</span><span>چهارشنبه</span>
          <strong>هر روز، یک منو</strong>
        </div>
      </section>
      <section className="login-form-area">
        <form className="login-form" onSubmit={submit}>
          <h2>ورود به حساب</h2>
          <p className="form-intro">برای ادامه، کد پرسنلی و رمز عبورت را وارد کن.</p>
          <label htmlFor="personnel-number">کد پرسنلی</label>
          <input
            autoComplete="username"
            autoCapitalize="none"
            id="personnel-number"
            inputMode="numeric"
            maxLength={32}
            onChange={(event) => setUsername(event.target.value)}
            required
            value={username}
          />
          <label htmlFor="password">رمز عبور</label>
          <input
            autoComplete="current-password"
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary login-submit" disabled={busy} type="submit">
            {busy ? 'در حال ورود…' : 'ورود'}
            {!busy && <ChevronLeft aria-hidden="true" size={18} />}
          </button>
          <p className="login-help">ورود نخستین‌بار با رمز اولیه نیازمند تغییر رمز است.</p>
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
    <main className="password-layout">
      <BrandMark />
      <form className="login-form password-form" onSubmit={submit}>
        <h1>یک رمز تازه انتخاب کن</h1>
        <p className="form-intro">برای امنیت حساب، پیش از ادامه رمز اولیه را عوض کن.</p>
        <label htmlFor="old-password">رمز فعلی</label>
        <input autoComplete="current-password" id="old-password" onChange={(event) => setOldPassword(event.target.value)} required type="password" value={oldPassword} />
        <label htmlFor="new-password">رمز جدید</label>
        <input autoComplete="new-password" id="new-password" onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} />
        <label htmlFor="confirm-password">تکرار رمز جدید</label>
        <input autoComplete="new-password" id="confirm-password" onChange={(event) => setConfirm(event.target.value)} required type="password" value={confirm} />
        <p className="field-hint">رمز باید شرایط امنیتی سامانه را داشته باشد و با کد پرسنلی برابر نباشد.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary login-submit" disabled={busy} type="submit">{busy ? 'در حال ذخیره…' : 'ذخیرهٔ رمز جدید'}</button>
      </form>
    </main>
  )
}

function BrandMark() {
  return (
    <div className="brand-mark">
      <span className="brand-symbol" aria-hidden="true"><Utensils size={21} strokeWidth={1.8} /></span>
      <span>پی‌آی فود</span>
    </div>
  )
}

function MainShell({
  user,
  page,
  onNavigate,
  onLogout,
  children,
}: {
  user: User
  page: Page
  onNavigate: (page: Page) => void
  onLogout: () => void
  children: React.ReactNode
}) {
  const items = [...navItems]
  if (canSeeReport(user)) items.push({ key: 'report', label: 'گزارش روزانه', icon: ChartNoAxesCombined })
  if (isManager(user)) items.push({ key: 'catalog', label: 'مدیریت منو', icon: Utensils })

  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="ناوبری اصلی">
        <BrandMark />
        <p className="nav-heading">سامانه</p>
        <nav className="side-nav">
          {items.map((item) => <NavButton key={item.key} item={item} active={page === item.key} onClick={() => onNavigate(item.key)} />)}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-code"><span className="user-dot" /> <span>کد پرسنلی</span><strong>{user.username}</strong></div>
          <button className="logout-button" onClick={onLogout} type="button"><LogOut size={17} /> خروج از حساب</button>
        </div>
      </aside>
      <header className="mobile-topbar">
        <BrandMark />
        <span className="mobile-user-code">{user.username}</span>
        <button aria-label="خروج از حساب" className="icon-button" onClick={onLogout} type="button"><LogOut size={18} /></button>
      </header>
      <main className="workspace" id="main-content">
        <div className="topbar">
          <div className="breadcrumb">پی‌آی فود <ChevronLeft aria-hidden="true" size={14} /> سامانه رزرو غذا</div>
          <div className="topbar-code">کد پرسنلی <strong>{user.username}</strong></div>
        </div>
        <div className="content-sheet">{children}</div>
      </main>
      <nav className="mobile-nav" aria-label="ناوبری پایین">
        {items.slice(0, 4).map((item) => <NavButton key={item.key} item={item} active={page === item.key} onClick={() => onNavigate(item.key)} />)}
      </nav>
    </div>
  )
}

function NavButton({ item, active, onClick }: { item: { key: Page; label: string; icon: typeof CalendarDays }; active: boolean; onClick: () => void }) {
  const Icon = item.icon
  return <button aria-current={active ? 'page' : undefined} className={`nav-button${active ? ' is-active' : ''}`} onClick={onClick} type="button"><Icon aria-hidden="true" size={18} /><span>{item.label}</span></button>
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

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = dateToIso(addDays(weekStart, index))
    return { date, menu: menus.find((menu) => menu.date === date) ?? null }
  }), [menus, weekStart])
  const reservationCount = menus.filter((menu) => menu.reservation?.status === 'res').length
  const visibleDays = days.filter(({ menu }) => {
    if (filter === 'reserved') return menu?.reservation?.status === 'res'
    if (filter === 'open') return menu && menu.can_reserve && menu.reservation?.status !== 'res'
    return true
  })

  return (
    <section className="page-section" aria-labelledby="week-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">برنامهٔ هفتگی</p>
          <h1 id="week-title">غذای هفته</h1>
          <p className="page-subtitle">هر روز یک غذا برای انتخاب؛ ساید و نوشیدنی اختیاری است.</p>
        </div>
        <button className="button button-secondary refresh-button" onClick={() => void load()} type="button"><RefreshCw size={16} /> تازه‌سازی</button>
      </div>

      <div className="week-toolbar">
        <div className="week-range">
          <button aria-label="هفتهٔ بعد" className="icon-button" onClick={() => setWeekStart((value) => addDays(value, 7))} type="button"><ChevronRight size={18} /></button>
          <strong>{formatDate(startIso, { weekday: undefined })} <span>تا</span> {formatDate(dateToIso(addDays(weekStart, 6)), { weekday: undefined })}</strong>
          <button aria-label="هفتهٔ قبل" className="icon-button" onClick={() => setWeekStart((value) => addDays(value, -7))} type="button"><ChevronLeft size={18} /></button>
          <button className="text-button" onClick={() => setWeekStart(getWeekStart(new Date()))} type="button">این هفته</button>
        </div>
        <div className="week-count"><strong>{new Intl.NumberFormat('fa-IR').format(reservationCount)}</strong><span>رزرو فعال</span></div>
      </div>

      <div className="filter-row" role="group" aria-label="فیلتر روزها">
        {([
          ['all', 'همهٔ روزها'], ['reserved', 'رزروهای من'], ['open', 'رزرو نشده'],
        ] as const).map(([key, label]) => <button aria-pressed={filter === key} className={`filter-button${filter === key ? ' selected' : ''}`} key={key} onClick={() => setFilter(key)} type="button">{label}</button>)}
      </div>

      {error && <ErrorMessage message={error} onRetry={() => void load()} />}
      {loading ? <LoadingRows /> : visibleDays.length === 0 ? <EmptyState title="روزی با این فیلتر پیدا نشد" detail="فیلتر دیگری را انتخاب کن." /> : (
        <div className="week-list">
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
    <article className={`day-row${today ? ' is-today' : ''}${index > 4 ? ' weekend' : ''}`}>
      <div className="day-date">
        <strong>{formatDate(date, { weekday: 'long' })}</strong>
        <span>{formatDate(date, { weekday: undefined, month: 'short' })}</span>
        {today && <span className="today-mark">امروز</span>}
      </div>
      <div className="day-meal">
        {menu ? <>
          <strong>{menu.food_name}</strong>
          <span>{formatMoney(menu.food_price)}</span>
        </> : <><strong className="muted-title">منویی ثبت نشده</strong><span>برای این روز هنوز غذایی در برنامه نیست.</span></>}
      </div>
      <div className="day-status">
        {activeReservation ? <>
          <span className="status-mark reserved-mark" />
          <span>رزرو شده</span>
        </> : reservation?.status === 'can' ? <>
          <span className="status-mark cancelled-mark" />
          <span>لغو شده</span>
        </> : menu ? <>
          <span className="status-mark open-mark" />
          <span>{menu.can_reserve ? 'رزرو نشده' : 'مهلت گذشته'}</span>
        </> : <span className="status-dash">—</span>}
      </div>
      <div className="day-action">
        {menu && (activeReservation
          ? menu.can_reserve
            ? <button className="button button-secondary" onClick={onEdit} type="button">ویرایش / لغو</button>
            : <button className="button button-disabled" disabled type="button">مهلت تمام شده</button>
          : menu.can_reserve
            ? <button className="button button-primary" onClick={onEdit} type="button"><Plus size={16} /> {reservation?.status === 'can' ? 'رزرو مجدد' : 'انتخاب غذا'}</button>
            : <button className="button button-disabled" disabled type="button">مهلت تمام شده</button>)}
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
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-labelledby="reservation-dialog-title" aria-modal="true" className="reservation-dialog" role="dialog">
        <div className="dialog-heading">
          <div><p className="eyebrow">{formatDate(menu.date)}</p><h2 id="reservation-dialog-title">{saved ? 'رزرو ثبت شد' : cancelled ? 'رزرو لغو شد' : menu.food_name}</h2></div>
          <button aria-label="بستن" className="icon-button" onClick={onClose} type="button"><X size={19} /></button>
        </div>
        {saved || cancelled ? <div className="success-panel" role="status">{saved ? 'انتخابت برای این روز ثبت شد.' : 'رزرو این روز لغو شد و در سوابق باقی ماند.'}</div> : <form className="reservation-form" onSubmit={save}>
          <p className="dialog-base-price">غذای روز <strong>{formatMoney(menu.food_price)}</strong></p>
          <QuantityField label="تعداد غذا" value={foodQuantity} onChange={setFoodQuantity} />
          <CatalogSelect label="ساید (اختیاری)" value={side} options={sides} onChange={setSide} />
          {side && <QuantityField label="تعداد ساید" value={sideQuantity} onChange={setSideQuantity} />}
          <CatalogSelect label="نوشیدنی (اختیاری)" value={drink} options={drinks} onChange={setDrink} />
          {drink && <QuantityField label="تعداد نوشیدنی" value={drinkQuantity} onChange={setDrinkQuantity} />}
          <div className="dialog-total"><span>جمع این انتخاب</span><strong>{formatMoney(total)}</strong></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary submit-reservation" disabled={saving || canceling} type="submit">{saving ? 'در حال ثبت…' : menu.reservation?.status === 'can' ? 'ثبت رزرو مجدد' : menu.reservation ? 'ذخیرهٔ ویرایش' : 'ثبت رزرو'}</button>
          {menu.reservation?.status === 'res' && <button className="button button-danger-quiet" disabled={saving || canceling} onClick={() => void cancelReservation()} type="button">{canceling ? 'در حال لغو…' : 'لغو غذای این روز'}</button>}
          <p className="cutoff-hint">مهلت رزرو و ویرایش تا ساعت ۱۰ صبح روز قبل است.</p>
        </form>}
      </section>
    </div>
  )
}

function CatalogSelect({ label, value, options, onChange }: { label: string; value: string; options: CatalogItem[]; onChange: (value: string) => void }) {
  return <label className="field-label">{label}<select onChange={(event) => onChange(event.target.value)} value={value}><option value="">انتخاب نکن</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatMoney(item.price)}</option>)}</select></label>
}

function QuantityField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="field-label quantity-label">{label}<input min={1} onChange={(event) => onChange(Math.max(1, Number(event.target.value)))} type="number" value={value} /></label>
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

  return <section className="page-section" aria-labelledby="history-title">
    <div className="page-heading"><div><p className="eyebrow">حساب من</p><h1 id="history-title">سوابق رزرو</h1><p className="page-subtitle">رزروها و نسخه‌های ویرایش‌شدهٔ قبلی در اینجا می‌مانند.</p></div></div>
    {error && <ErrorMessage message={error} />}
    {loading ? <LoadingRows /> : reservations.length === 0 ? <EmptyState title="هنوز رزروی ثبت نکرده‌ای" detail="از صفحهٔ رزرو هفته می‌توانی غذای روزها را انتخاب کنی." /> : <div className="history-list">
      {reservations.map((reservation) => <article className="history-row" key={reservation.id}>
        <div className="history-main"><span className="history-date">{formatDate(reservation.menu_date)}</span><strong>{reservation.food_name}</strong><span className={`status-text ${reservation.status === 'res' ? 'positive-text' : 'muted-text'}`}>{reservation.status === 'res' ? 'رزرو فعال' : 'لغو شده'}</span></div>
        <div className="history-total">{formatMoney(reservation.total_price)}</div>
        <details className="history-details"><summary>{new Intl.NumberFormat('fa-IR').format(reservation.history.length)} نسخهٔ ثبت‌شده</summary><ol>{reservation.history.map((item) => <li key={item.id}><span>{new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.datetime_created ?? Date.now()))}</span><span>{item.is_cancelled ? 'لغو رزرو' : [item.side_name, item.drink_name].filter(Boolean).join('، ') || 'بدون ساید و نوشیدنی'}</span><strong>{formatMoney(item.total_price)}</strong></li>)}</ol></details>
      </article>)}
    </div>}
  </section>
}

function ReportPage() {
  const today = dateToIso(new Date())
  const firstDay = `${today.slice(0, 8)}01`
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

  return <section className="page-section" aria-labelledby="report-title">
    <div className="page-heading"><div><p className="eyebrow">گزارش مدیریتی</p><h1 id="report-title">گزارش روزانهٔ رزرو</h1><p className="page-subtitle">تعداد غذا و مبلغ رزروهای فعال را بر اساس تاریخ ببین.</p></div></div>
    <form className="report-filters" onSubmit={(event) => void loadReport(event)}>
      <label className="field-label">از تاریخ<input onChange={(event) => setFromDate(event.target.value)} required type="date" value={fromDate} /></label>
      <label className="field-label">تا تاریخ<input onChange={(event) => setToDate(event.target.value)} required type="date" value={toDate} /></label>
      <button className="button button-primary" disabled={loading} type="submit">{loading ? 'در حال دریافت…' : 'نمایش گزارش'}</button>
    </form>
    {error && <ErrorMessage message={error} onRetry={() => void loadReport()} />}
    {loaded && !error && <>
      <div className="report-totals"><div><span>رزرو فعال در این بازه</span><strong>{new Intl.NumberFormat('fa-IR').format(reserved)}</strong></div><div><span>جمع مبالغ</span><strong>{formatMoney(total)}</strong></div></div>
      {rows.length === 0 ? <EmptyState title="برای این بازه منویی ثبت نشده" detail="تاریخ دیگری را انتخاب کن." /> : <div className="report-table-wrap"><table className="report-table"><thead><tr><th>تاریخ</th><th>غذا</th><th>رزرو</th><th>لغو</th><th>تعداد غذا</th><th>جمع (تومان)</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.date}-${row.food}`}><td>{formatDate(row.date)}</td><td>{row.food}</td><td>{new Intl.NumberFormat('fa-IR').format(row.reserved_count)}</td><td>{new Intl.NumberFormat('fa-IR').format(row.cancelled_count)}</td><td>{new Intl.NumberFormat('fa-IR').format(row.food_quantity)}</td><td>{new Intl.NumberFormat('fa-IR').format(row.total_toman)}</td></tr>)}</tbody></table></div>}
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

  return <section className="page-section" aria-labelledby="catalog-title">
    <div className="page-heading"><div><p className="eyebrow">ویژهٔ HR</p><h1 id="catalog-title">مدیریت منو</h1><p className="page-subtitle">غذاها و گزینه‌های جانبی را مدیریت و منوی روز را تعیین کن.</p></div><button aria-label="تازه‌سازی کاتالوگ" className="icon-button" onClick={() => void loadCatalog()} type="button"><RefreshCw size={18} /></button></div>
    {notice && <p className="form-success" role="status">{notice}</p>}
    {error && <ErrorMessage message={error} />}
    {loading ? <LoadingRows /> : <div className="management-layout">
      <section className="management-block"><h2>ثبت منوی روز</h2><form className="management-form" onSubmit={(event) => void createMenu(event)}><label className="field-label">تاریخ<input onChange={(event) => setMenuDate(event.target.value)} required type="date" value={menuDate} /></label><label className="field-label">غذای روز<select onChange={(event) => setSelectedFood(event.target.value)} required value={selectedFood}>{foods.map((food) => <option key={food.id} value={food.id}>{food.name} · {formatMoney(food.total_price)}</option>)}</select></label><button className="button button-primary" disabled={!foods.length} type="submit">ثبت منو</button></form></section>
      <section className="management-block"><h2>افزودن غذا</h2><form className="management-form two-columns" onSubmit={(event) => void createFood(event)}><label className="field-label span-two">نام غذا<input onChange={(event) => setFoodName(event.target.value)} required value={foodName} /></label><label className="field-label">قیمت غذا (تومان)<input min={0} onChange={(event) => setFoodPrice(event.target.value)} required type="number" value={foodPrice} /></label><label className="field-label">قیمت ظرف (تومان)<input min={0} onChange={(event) => setContainerPrice(event.target.value)} required type="number" value={containerPrice} /></label><button className="button button-primary span-two" type="submit">افزودن غذا</button></form></section>
      <section className="management-block"><h2>افزودن گزینهٔ جانبی</h2><form className="management-form two-columns" onSubmit={(event) => void createCatalogItem(event)}><label className="field-label">نوع گزینه<select onChange={(event) => setKind(event.target.value as CatalogKind)} value={kind}><option value="sides">ساید</option><option value="drinks">نوشیدنی</option></select></label><label className="field-label">نام<input onChange={(event) => setItemName(event.target.value)} required value={itemName} /></label><label className="field-label span-two">قیمت (تومان)<input min={0} onChange={(event) => setItemPrice(event.target.value)} required type="number" value={itemPrice} /></label><button className="button button-primary span-two" type="submit">افزودن گزینه</button></form></section>
      <CatalogSummary foods={foods} sides={sides} drinks={drinks} />
    </div>}
  </section>
}

function CatalogSummary({ foods, sides, drinks }: { foods: CatalogItem[]; sides: CatalogItem[]; drinks: CatalogItem[] }) {
  return <section className="management-summary" aria-label="کاتالوگ موجود"><h2>کاتالوگ موجود</h2><div className="summary-list"><span>غذا <strong>{foods.length}</strong></span><span>ساید <strong>{sides.length}</strong></span><span>نوشیدنی <strong>{drinks.length}</strong></span></div></section>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span className="empty-mark" aria-hidden="true"><Utensils size={20} /></span><h2>{title}</h2><p>{detail}</p></div>
}

function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="error-message" role="alert"><span>{message}</span>{onRetry && <button className="text-button" onClick={onRetry} type="button">تلاش دوباره</button>}</div>
}

function LoadingRows() {
  return <div aria-label="در حال بارگذاری" aria-live="polite" className="loading-rows"><span /><span /><span /></div>
}
