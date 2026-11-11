import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { api } from '../api/client'
import { getProfile, getProfileOptions } from '../api/endpoints'
import type { CatalogItem, ProfileOption, Reservation, WeeklyMenu } from '../api/types'
import EmptyState from '../components/ui/EmptyState'
import ErrorMessage from '../components/ui/ErrorMessage'
import LoadingRows from '../components/ui/LoadingRows'
import CatalogMultiSelect from '../components/ui/CatalogMultiSelect'
import type { CatalogQuantities } from '../components/ui/CatalogMultiSelect'
import QuantityField from '../components/ui/QuantityField'
import { buttonClass, iconButtonClass } from '../components/ui/buttonStyles'
import { addDays, dateToIso, formatDate, formatWeekday, getWeekStart } from '../utils/date'
import { getApiMessage } from '../utils/errors'
import { formatMoney } from '../utils/format'

function initialQuantities(
  entries: { id: number; quantity: number }[] | undefined,
  legacyId: number | null | undefined,
  legacyQuantity: number | undefined,
): CatalogQuantities {
  if (entries !== undefined) {
    return Object.fromEntries(
      entries.map((entry) => [entry.id, entry.quantity]),
    )
  }

  if (legacyId != null && (legacyQuantity ?? 0) > 0) {
    return { [legacyId]: legacyQuantity ?? 1 }
  }

  return {}
}

function selectionTotal(
  items: CatalogItem[],
  quantities: CatalogQuantities,
): number {
  return items.reduce(
    (total, item) => total + item.price * (quantities[item.id] ?? 0),
    0,
  )
}

export default function WeekPage() {
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

  useEffect(() => {
    let active = true

    Promise.all([
      api<WeeklyMenu[]>(`/reservations/weekly?start=${startIso}`),
      api<CatalogItem[]>('/sides'),
      api<CatalogItem[]>('/drinks'),
    ])
      .then(([weekMenus, sideItems, drinkItems]) => {
        if (!active) return
        setMenus(weekMenus)
        setSides(sideItems)
        setDrinks(drinkItems)
      })
      .catch((loadError: unknown) => {
        if (active) setError(getApiMessage(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [startIso])

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
          <p className="mt-[7px] mb-0 text-sm leading-[1.7] text-muted max-[680px]:max-w-[440px] max-[680px]:text-xs">هر روز یک غذا برای انتخاب؛ پیش‌غذا و نوشیدنی اختیاری است.</p>
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
          <button aria-label="هفتهٔ قبل" className={`${iconButtonClass} max-[680px]:h-[34px] max-[680px]:w-[34px]`} onClick={() => setWeekStart((value) => addDays(value, -7))} type="button"><ChevronRight size={18} /></button>
          <strong className="whitespace-nowrap text-sm max-[680px]:text-xs">{formatDate(startIso, { weekday: undefined })} <span className="mx-1 font-normal text-muted">تا</span> {formatDate(dateToIso(addDays(weekStart, 5)), { weekday: undefined })}</strong>
          <button aria-label="هفتهٔ بعد" className={`${iconButtonClass} max-[680px]:h-[34px] max-[680px]:w-[34px]`} onClick={() => setWeekStart((value) => addDays(value, 7))} type="button"><ChevronLeft size={18} /></button>
          <button className={buttonClass('primary', 'min-h-[36px] px-3 py-1.5 text-xs whitespace-nowrap max-[680px]:min-h-[34px] max-[680px]:px-2')} onClick={() => setWeekStart(getWeekStart(new Date()))} type="button">هفته جاری</button>
        </div>
        <div className="flex items-baseline gap-[7px] text-xs text-muted max-[680px]:self-start"><strong className="text-xl text-accent">{new Intl.NumberFormat('fa-IR').format(reservationCount)}</strong><span>رزرو فعال</span></div>
      </div>

      <div className="my-3 mt-[18px] flex flex-wrap gap-[7px] max-[680px]:my-2 max-[680px]:mt-[13px] max-[680px]:flex-nowrap max-[680px]:overflow-x-auto max-[680px]:pb-[3px]" role="group" aria-label="فیلتر روزها">
        {([
          ['all', 'همهٔ روزها'], ['reserved', 'رزروهای من'], ['open', 'رزرو نشده'],
        ] as const).map(([key, label]) => <button aria-pressed={filter === key} className={`inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center rounded-full border px-3 py-[7px] text-xs transition-colors duration-150 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#63a5b4] ${filter === key ? 'border-accent/40 bg-accent-soft font-semibold text-accent' : 'border-line bg-surface font-normal text-muted hover:bg-raised hover:text-ink'}`} key={key} onClick={() => setFilter(key)} type="button">{label}</button>)}
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
        <strong className="text-sm max-[680px]:text-[13px]">{formatWeekday(date)}</strong>
        <span className="text-xs text-muted max-[680px]:text-[11px]">{formatDate(date, { weekday: undefined, month: 'short' })}</span>
        {today && <span className="mt-[2px] self-start text-[11px] font-semibold text-accent max-[680px]:mt-0">امروز</span>}
      </div>
      <div className="flex min-w-0 flex-col gap-1 max-[680px]:col-start-1 max-[680px]:row-start-2">
        {menu ? (
          <div className="flex min-w-0 items-center gap-3">
            {menu.food_image_data?.url && (
              <img
                src={menu.food_image_data.url}
                alt={menu.food_image_data.alt}
                loading="lazy"
                className="h-14 w-14 shrink-0 rounded-lg object-cover"
              />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <strong className="truncate text-sm max-[680px]:text-[13px]">
                {menu.food_name}
              </strong>
              <span className="text-xs text-muted">
                {formatMoney(menu.food_price)}
              </span>
            </div>
          </div>
        ) : <><strong className="truncate text-sm text-muted max-[680px]:text-[13px]">منویی ثبت نشده</strong><span className="text-xs text-muted">برای این روز هنوز غذایی در برنامه نیست.</span></>}
      </div>
      <div className="flex items-center gap-2 whitespace-nowrap text-xs text-muted max-[680px]:col-start-2 max-[680px]:row-start-1 max-[680px]:justify-self-end max-[680px]:text-[11px]">
        {activeReservation ? <>
          <span className="h-2 w-2 rounded-full bg-positive" />
          <span>رزرو شده</span>
        </> : reservation?.status === 'can' ? <>
          <span className="h-2 w-2 rounded-full bg-[#92999d]" />
          <span>لغو شده</span>
        </> : menu ? <>
          <span className="h-2 w-2 rounded-full bg-[#d49b38]" />
          <span>{menu.can_reserve ? 'رزرو نشده' : 'مهلت گذشته'}</span>
        </> : <span className="text-muted">—</span>}
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
  const [building, setBuilding] = useState(current?.building?.toString() ?? '')
  const [buildingOptions, setBuildingOptions] = useState<ProfileOption[]>([])
  const [buildingLoading, setBuildingLoading] = useState(true)
  const [buildingLoadError, setBuildingLoadError] = useState('')
  const [sideQuantities, setSideQuantities] = useState<CatalogQuantities>(() =>
    initialQuantities(
      current?.side_items?.map((entry) => ({
        id: entry.side,
        quantity: entry.quantity,
      })),
      current?.side,
      current?.side_quantity,
    ),
  )
  const [drinkQuantities, setDrinkQuantities] = useState<CatalogQuantities>(() =>
    initialQuantities(
      current?.drink_items?.map((entry) => ({
        id: entry.drink,
        quantity: entry.quantity,
      })),
      current?.drink,
      current?.drink_quantity,
    ),
  )
  const [foodQuantity, setFoodQuantity] = useState(current?.food_quantity ?? 1)
  const [saving, setSaving] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const dialogRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    let active = true

    Promise.all([getProfile(), getProfileOptions()])
      .then(([profile, options]) => {
        if (!active) return

        setBuildingOptions(options.buildings)

        if (!menu.reservation) {
          const profileBuilding = profile.building
          const isAvailable = options.buildings.some(
            (option) => option.id === profileBuilding,
          )
          setBuilding(
            profileBuilding !== null && isAvailable
              ? String(profileBuilding)
              : '',
          )
        }
      })
      .catch((loadError: unknown) => {
        if (active) setBuildingLoadError(getApiMessage(loadError))
      })
      .finally(() => {
        if (active) setBuildingLoading(false)
      })

    return () => {
      active = false
    }
  }, [menu.reservation])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

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
    + selectionTotal(sides, sideQuantities)
    + selectionTotal(drinks, drinkQuantities)

  async function save(event: FormEvent) {
    event.preventDefault()
    setError('')

    if (!building || !Number.isInteger(Number(building))) {
      setError('انتخاب ساختمان محل تحویل الزامی است.')
      return
    }

    if (buildingLoading || buildingLoadError) {
      setError('اطلاعات ساختمان‌ها هنوز آماده نیست.')
      return
    }

    setSaving(true)
    const item = {
      ...(
        menu.reservation
          ? building !== (current?.building?.toString() ?? '')
            ? { building: Number(building) }
            : {}
          : { building: Number(building) }
      ),
      food_quantity: foodQuantity,
      sides: Object.entries(sideQuantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([side, quantity]) => ({
          side: Number(side),
          quantity,
        })),
      drinks: Object.entries(drinkQuantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([drink, quantity]) => ({
          drink: Number(drink),
          quantity,
        })),
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
    <div className="fixed inset-0 z-10 grid place-items-center overflow-y-auto bg-[#10232b80] p-5">
      <button
        type="button"
        aria-label="بستن پنجره رزرو با کلیک روی پس‌زمینه"
        className="absolute inset-0 h-full w-full cursor-default border-0 bg-transparent"
        onClick={onClose}
        tabIndex={-1}
      />
      <section aria-labelledby="reservation-dialog-title" aria-modal="true" className="relative z-10 w-full max-w-[480px] max-h-[min(90svh,760px)] overflow-y-auto rounded-2xl border border-line bg-surface text-ink p-[22px] shadow-[0_20px_70px_#09252d33] max-[680px]:max-h-[88svh] max-[680px]:self-end max-[680px]:rounded-t-2xl max-[680px]:rounded-b-[10px] max-[680px]:p-[19px]" ref={dialogRef} tabIndex={-1} role="dialog">
        <div className="flex items-start justify-between gap-3 border-b border-line pb-[17px]">
          <div><p className="mt-0 mb-[3px] text-xs font-bold text-accent">{formatDate(menu.date)}</p><h2 className="m-0 text-xl" id="reservation-dialog-title">{saved ? 'رزرو ثبت شد' : cancelled ? 'رزرو لغو شد' : menu.food_name}</h2></div>
          <button aria-label="بستن" className={iconButtonClass} onClick={onClose} type="button"><X size={19} /></button>
        </div>
        {saved || cancelled ? <div className="rounded-[9px] border border-[#c9e5d7] bg-[#f0faf4] p-[14px] leading-[1.8] text-[#176441] dark:border-positive/40 dark:bg-raised dark:text-positive" role="status">{saved ? 'انتخابت برای این روز ثبت شد.' : 'رزرو این روز لغو شد و در سوابق باقی ماند.'}</div> : <form className="grid gap-[11px] pt-4" onSubmit={save}>
          <p className="m-0 flex justify-between gap-[10px] py-[11px] text-[13px] text-muted">غذای روز <strong className="text-ink">{formatMoney(menu.food_price)}</strong></p>
          <label className="m-0 flex flex-col gap-2 text-sm font-semibold text-ink">
            ساختمان محل تحویل
            <select
              className="min-h-[46px] w-full rounded-[9px] border border-line bg-surface px-[13px] py-[10px] text-ink"
              disabled={buildingLoading || Boolean(buildingLoadError)}
              onChange={(event) => setBuilding(event.target.value)}
              required
              value={building}
            >
              <option value="">انتخاب ساختمان</option>
              {current?.building != null &&
                !buildingOptions.some((option) => option.id === current.building) && (
                  <option value={current.building}>
                    ساختمان {current.building_number_snapshot ?? 'قبلی'} (ثبت‌شده)
                  </option>
                )}
              {buildingOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  ساختمان {option.number}
                </option>
              ))}
            </select>
          </label>
          {buildingLoading && (
            <p className="m-0 text-xs text-muted" role="status">
              در حال دریافت اطلاعات ساختمان‌ها…
            </p>
          )}
          {buildingLoadError && (
            <p className="m-0 text-xs text-red-700" role="alert">
              دریافت ساختمان‌ها ناموفق بود: {buildingLoadError}
            </p>
          )}
          <QuantityField label="تعداد غذا" value={foodQuantity} onChange={setFoodQuantity} />
          <CatalogMultiSelect
            label="پیش‌غذا (اختیاری)"
            items={sides}
            quantities={sideQuantities}
            onChange={setSideQuantities}
            disabled={saving || canceling}
          />
          <CatalogMultiSelect
            label="نوشیدنی (اختیاری)"
            items={drinks}
            quantities={drinkQuantities}
            onChange={setDrinkQuantities}
            disabled={saving || canceling}
          />
          <div className="mt-1 flex justify-between gap-[10px] border-t border-line py-[11px] text-sm text-muted"><span>جمع این انتخاب</span><strong className="text-ink">{formatMoney(total)}</strong></div>
          {error && <p className="mb-[15px] rounded-[9px] border border-[#f0c9cb] bg-[#fff4f4] px-[14px] py-3 text-sm leading-[1.7] text-[#8b242a] dark:border-negative/40 dark:bg-raised dark:text-negative" role="alert">{error}</p>}
          <button className={buttonClass('primary', 'w-full')} disabled={saving || canceling || buildingLoading || Boolean(buildingLoadError)} type="submit">{saving ? 'در حال ثبت…' : menu.reservation?.status === 'can' ? 'ثبت رزرو مجدد' : menu.reservation ? 'ذخیرهٔ ویرایش' : 'ثبت رزرو'}</button>
          {menu.reservation?.status === 'res' && <button className={buttonClass('dangerQuiet', '')} disabled={saving || canceling} onClick={() => void cancelReservation()} type="button">{canceling ? 'در حال لغو…' : 'لغو غذای این روز'}</button>}
          <p className="mt-px mb-0 text-center text-[11px] text-muted">مهلت رزرو و ویرایش تا ساعت ۱۰ صبح روز قبل است.</p>
        </form>}
      </section>
    </div>
  )
}
