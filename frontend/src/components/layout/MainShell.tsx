import {
  CalendarDays,
  ChartNoAxesCombined,
  ChevronLeft,
  ClipboardList,
  LogOut,
  UserRound,
  Utensils,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { User } from '../../api/types'
import type { Page } from '../../app/navigation'
import { canSeeReport, isManager } from '../../app/permissions'
import { iconButtonClass } from '../ui/buttonStyles'
import BrandMark from './BrandMark'

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
  const items = [...navItems]
  if (canSeeReport(user)) items.push({ key: 'report', label: 'گزارش روزانه', icon: ChartNoAxesCombined })
  if (isManager(user)) items.push({ key: 'catalog', label: 'مدیریت منو', icon: Utensils })

  return (
    <div className="min-h-svh" dir="rtl">
      <aside className="sidebar fixed inset-y-0 start-0 z-[4] flex w-[236px] flex-col border-e border-line bg-white px-[18px] pt-[26px] pb-[18px] max-[900px]:w-[205px] max-[680px]:hidden" aria-label="ناوبری اصلی">
        <BrandMark variant="sidebar" />
        <p className="mx-[9px] mt-0 mb-[9px] text-xs text-[#858b8f]">سامانه</p>
        <nav className="grid gap-1">
          {items.map((item) => <NavButton key={item.key} item={item} active={page === item.key} onClick={() => onNavigate(item.key)} />)}
        </nav>
        <div className="mt-auto border-t border-line pt-[15px]">
          <div className="grid grid-cols-[10px_1fr] gap-x-2 gap-y-[3px] px-[6px] pt-[10px] pb-4 text-xs text-muted"><span className="row-span-2 mt-1 h-2 w-2 rounded-full bg-positive" /> <span>کد پرسنلی</span><strong className="col-start-2 text-sm text-ink">{user.username}</strong></div>
          <button className="flex min-h-[42px] w-full cursor-pointer items-center gap-[10px] border-0 bg-transparent px-[7px] text-[13px] text-[#565e62] hover:text-negative" onClick={onLogout} type="button"><LogOut size={17} /> خروج از حساب</button>
        </div>
      </aside>
      <header className="mobile-topbar sticky top-0 z-[5] hidden h-[58px] items-center gap-[10px] border-b border-line bg-white/95 px-4 backdrop-blur-md max-[680px]:flex">
        <BrandMark variant="mobile" />
        <span className="text-xs text-muted">{user.username}</span>
        <button aria-label="خروج از حساب" className={iconButtonClass} onClick={onLogout} type="button"><LogOut size={18} /></button>
      </header>
      <main className={`min-h-svh ms-[236px] px-9 pb-12 max-[900px]:ms-[205px] max-[900px]:px-[23px] max-[680px]:ms-0 max-[680px]:min-h-0 max-[680px]:px-4 max-[680px]:pb-[93px] ${page === 'profile' ? 'min-[681px]:pb-3' : ''}`} id="main-content">
        <div className="flex h-[65px] items-center justify-between border-b border-line text-[13px] text-muted max-[680px]:hidden">
          <div className="flex items-center gap-[7px]">پی‌آی فود <ChevronLeft aria-hidden="true" size={14} /> سامانه رزرو غذا</div>
          <div>کد پرسنلی <strong className="ms-[5px] text-ink">{user.username}</strong></div>
        </div>
        <div className={`mx-auto mt-7 w-full max-w-[1060px] max-[680px]:mt-[22px] ${page === 'profile' ? 'min-[681px]:mt-3' : ''}`}>{children}</div>
      </main>
      <nav className="mobile-nav fixed inset-x-0 bottom-0 z-[6] hidden justify-around border-t border-line bg-white/95 backdrop-blur-md max-[680px]:flex" aria-label="ناوبری پایین">
        {items.map((item) => <NavButton key={item.key} item={item} active={page === item.key} onClick={() => onNavigate(item.key)} />)}
      </nav>
    </div>
  )
}

function NavButton({ item, active, onClick }: { item: { key: Page; label: string; icon: typeof CalendarDays }; active: boolean; onClick: () => void }) {
  const Icon = item.icon
  return <button aria-current={active ? 'page' : undefined} className={`nav-button flex min-h-11 cursor-pointer items-center gap-[11px] rounded-[9px] border-0 bg-transparent px-[11px] text-right text-sm transition-colors max-[680px]:min-w-0 max-[680px]:min-h-[51px] max-[680px]:flex-1 max-[680px]:flex-col max-[680px]:justify-center max-[680px]:gap-[3px] max-[680px]:px-[2px] max-[680px]:py-[5px] max-[680px]:text-[10px] ${active ? 'bg-accent-soft font-semibold text-accent' : 'text-[#555d61] hover:bg-raised'}`} onClick={onClick} type="button"><Icon aria-hidden="true" size={18} /><span>{item.label}</span></button>
}
