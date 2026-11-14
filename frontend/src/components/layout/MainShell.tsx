import {
  CalendarDays,
  ChartNoAxesCombined,
  ChevronLeft,
  ClipboardList,
  LogOut,
  Moon,
  Sun,
  Wallet,
  UserRound,
  Utensils,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { api, RESERVATIONS_CHANGED_EVENT } from '../../api/client'
import type { User } from '../../api/types'
import { formatMoney } from '../../utils/format'
import type { Page } from '../../app/navigation'
import { canSeeReport, isManager } from '../../app/permissions'
import { iconButtonClass } from '../ui/buttonStyles'
import BrandMark from './BrandMark'
import { useBranding } from '../../app/branding'
import {
  getCurrentTheme,
  THEME_CHANGED_EVENT,
  toggleTheme,
} from '../../app/theme'

type WalletSummary = {
  month: string
  spent_toman: number
  reservation_count: number
}

const navItems: { key: Page; label: string; icon: typeof CalendarDays }[] = [
  { key: 'week', label: 'رزرو هفته', icon: CalendarDays },
  { key: 'history', label: 'سوابق من', icon: ClipboardList },
  { key: 'profile', label: 'پروفایل', icon: UserRound },
]

export default function MainShell({
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
  children: ReactNode
}) {
  const branding = useBranding()
  const [wallet, setWallet] = useState<WalletSummary | null>(null)
  const [walletError, setWalletError] = useState(false)
  const [theme, setCurrentTheme] = useState(getCurrentTheme)

  useEffect(() => {
    const syncTheme = () => setCurrentTheme(getCurrentTheme())

    window.addEventListener(THEME_CHANGED_EVENT, syncTheme)

    return () => {
      window.removeEventListener(THEME_CHANGED_EVENT, syncTheme)
    }
  }, [])

  useEffect(() => {
    let active = true
    let requestId = 0

    function refreshWallet() {
      const currentRequest = ++requestId

      api<WalletSummary>('/reservations/wallet-summary')
        .then((result) => {
          if (!active || currentRequest !== requestId) return
          setWallet(result)
          setWalletError(false)
        })
        .catch(() => {
          if (!active || currentRequest !== requestId) return
          setWallet(null)
          setWalletError(true)
        })
    }

    function refreshWhenVisible() {
      if (!document.hidden) refreshWallet()
    }

    refreshWallet()

    window.addEventListener(
      RESERVATIONS_CHANGED_EVENT,
      refreshWallet,
    )
    window.addEventListener('focus', refreshWallet)
    document.addEventListener(
      'visibilitychange',
      refreshWhenVisible,
    )

    // Also refresh automatically if a month changes in an open tab.
    const refreshInterval = window.setInterval(
      refreshWallet,
      5 * 60 * 1000,
    )

    return () => {
      active = false
      window.clearInterval(refreshInterval)
      window.removeEventListener(
        RESERVATIONS_CHANGED_EVENT,
        refreshWallet,
      )
      window.removeEventListener('focus', refreshWallet)
      document.removeEventListener(
        'visibilitychange',
        refreshWhenVisible,
      )
    }
  }, [page, user.id])

  const walletAmount = walletError
    ? 'در دسترس نیست'
    : wallet
      ? formatMoney(wallet.spent_toman)
      : 'در حال دریافت...'

  const walletMonth = wallet?.month.replace('-', '/')

  const themeToggle = (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink transition-colors hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      aria-label={theme === 'dark' ? 'فعال‌کردن حالت روشن' : 'فعال‌کردن حالت تاریک'}
      title={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}
      aria-pressed={theme === 'dark'}
    >
      {theme === 'dark'
        ? <Sun size={18} aria-hidden="true" />
        : <Moon size={18} aria-hidden="true" />}
    </button>
  )

  const items = [...navItems]
  if (canSeeReport(user)) items.push({ key: 'report', label: 'گزارش روزانه', icon: ChartNoAxesCombined })
  if (isManager(user)) items.push({ key: 'catalog', label: 'مدیریت منو', icon: Utensils })

  return (
    <div className="min-h-svh" dir="rtl">
      <aside className="sidebar fixed inset-y-0 start-0 z-[4] flex w-[236px] flex-col border-e border-line bg-surface px-[18px] pt-[26px] pb-[18px] max-[900px]:w-[205px] max-[680px]:hidden" aria-label="ناوبری اصلی">
        <BrandMark variant="sidebar" />
        <p className="mx-[9px] mt-0 mb-[9px] text-xs text-[#858b8f]">سامانه</p>
        <nav className="grid gap-1">
          {items.map((item) => <NavButton key={item.key} item={item} active={page === item.key} onClick={() => onNavigate(item.key)} />)}
        </nav>

        <div
          className="mt-5 rounded-xl border border-line bg-raised px-3 py-3"
          aria-label="هزینه رزروهای ماه جاری"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-ink">
              <Wallet size={16} aria-hidden="true" />
              کیف پول
            </span>
            <span className="text-[11px] text-muted">
              {walletMonth ?? 'ماه جاری'}
            </span>
          </div>

          <p
            className="mb-0 mt-3 text-sm font-bold text-ink"
            aria-live="polite"
          >
            {walletAmount}
          </p>

          <p className="mb-0 mt-2 text-[11px] text-muted">
            هزینه رزروهای این ماه
          </p>
        </div>

        <div className="mt-auto border-t border-line pt-[15px]">
          <div className="grid grid-cols-[10px_1fr] gap-x-2 gap-y-[3px] px-[6px] pt-[10px] pb-4 text-xs text-muted"><span className="row-span-2 mt-1 h-2 w-2 rounded-full bg-positive" /> <span>کد پرسنلی</span><strong className="col-start-2 text-sm text-ink">{user.username}</strong></div>
          <button className="flex min-h-[42px] w-full cursor-pointer items-center gap-[10px] border-0 bg-transparent px-[7px] text-[13px] text-muted hover:text-negative" onClick={onLogout} type="button"><LogOut size={17} /> خروج از حساب</button>
        </div>
      </aside>
      <header className="mobile-topbar sticky top-0 z-[5] hidden min-h-[64px] items-center gap-2 border-b border-line bg-surface/95 px-3 py-2 backdrop-blur-md max-[680px]:flex">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <BrandMark variant="mobile" />
          <span
            className="block min-w-0 truncate ps-1 text-[11px] text-muted"
            aria-label={`کد پرسنلی: ${user.username}`}
            title={user.username}
          >
            کد پرسنلی: <strong className="text-ink">{user.username}</strong>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="flex min-w-0 flex-col items-center gap-0.5 text-[10px] text-muted"
            aria-label="هزینه رزروهای ماه جاری"
          >
            <span className="inline-flex items-center gap-1">
              <Wallet size={13} className="shrink-0 text-accent" aria-hidden="true" />
              <span className="max-w-[90px] truncate" aria-live="polite">
                {walletAmount}
              </span>
            </span>
            <span className="text-[9px] leading-none text-muted">
              {walletMonth ?? 'ماه جاری'}
            </span>
          </span>
        </div>
        {themeToggle}
        <button aria-label="خروج از حساب" className={iconButtonClass} onClick={onLogout} type="button"><LogOut size={18} /></button>
      </header>
      <main className={`min-h-svh ms-[236px] px-9 pb-12 max-[900px]:ms-[205px] max-[900px]:px-[23px] max-[680px]:ms-0 max-[680px]:min-h-0 max-[680px]:px-4 max-[680px]:pb-[93px] ${page === 'profile' ? 'min-[681px]:pb-3' : ''}`} id="main-content">
        <div className="flex h-[65px] items-center justify-between border-b border-line text-[13px] text-muted max-[680px]:hidden">
          <div className="flex items-center gap-[7px]">{branding.site_name} <ChevronLeft aria-hidden="true" size={14} /> {branding.site_description}</div>
          <div className="flex items-center gap-3">
            <div>کد پرسنلی <strong className="ms-[5px] text-ink">{user.username}</strong></div>
            {themeToggle}
          </div>
        </div>
        <div className={`mx-auto mt-7 w-full max-w-[1060px] max-[680px]:mt-[22px] ${page === 'profile' ? 'min-[681px]:mt-3' : ''}`}>{children}</div>
      </main>
      <nav style={{ "--mobile-nav-count": items.length } as CSSProperties} className="mobile-nav fixed inset-x-0 bottom-0 z-[6] hidden grid-cols-[repeat(var(--mobile-nav-count),minmax(0,1fr))] border-t border-line bg-surface/95 backdrop-blur-md max-[680px]:grid" aria-label="ناوبری پایین">
        {items.map((item) => <NavButton key={item.key} item={item} active={page === item.key} onClick={() => onNavigate(item.key)} />)}
      </nav>
    </div>
  )
}

function NavButton({ item, active, onClick }: { item: { key: Page; label: string; icon: typeof CalendarDays }; active: boolean; onClick: () => void }) {
  const Icon = item.icon
  return <button aria-current={active ? 'page' : undefined} className={`nav-button flex min-h-11 cursor-pointer items-center gap-[11px] rounded-[9px] border-0 bg-transparent px-[11px] text-right text-sm transition-colors max-[680px]:min-w-0 max-[680px]:min-h-[51px] max-[680px]:w-full max-[680px]:flex-col max-[680px]:items-center max-[680px]:justify-center max-[680px]:gap-[3px] max-[680px]:px-[2px] max-[680px]:py-[5px] max-[680px]:text-center max-[680px]:text-xs ${active ? 'bg-accent-soft font-semibold text-accent' : 'text-[#555d61] dark:text-muted hover:bg-raised'}`} onClick={onClick} type="button"><Icon aria-hidden="true" size={18} /><span>{item.label}</span></button>
}
