import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'

// Intl uses the Persian calendar for display; selected values remain ISO Gregorian for the Django API.
const numeric = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
  year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC',
})
const monthNames = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
const weekdays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
const fa = (n: number) => n.toLocaleString('fa-IR', { useGrouping: false })

function localTodayISO(): string {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}
function fromIso(value: string): Date {
  return new Date(`${value}T12:00:00Z`)
}
function iso(date: Date): string {
  return date.toISOString().slice(0, 10)
}
function plusDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}
function parts(date: Date): { year: number; month: number; day: number } {
  const values = Object.fromEntries(numeric.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]))
  return { year: values.year, month: values.month, day: values.day }
}
function monthStart(date: Date): Date {
  return plusDays(date, 1 - parts(date).day)
}
function nextMonth(date: Date): Date {
  const start = monthStart(date)
  let cursor = plusDays(start, 29)
  const current = parts(start)
  while (parts(cursor).year === current.year && parts(cursor).month === current.month) {
    cursor = plusDays(cursor, 1)
  }
  return cursor
}
function previousMonth(date: Date): Date {
  return monthStart(plusDays(monthStart(date), -1))
}
export function jalaliMonthStartISO(value: string): string {
  return iso(monthStart(fromIso(value)))
}
export function displayJalaliISO(value: string): string {
  const { year, month, day } = parts(fromIso(value))
  return `${fa(year)}/${fa(month).padStart(2, '۰')}/${fa(day).padStart(2, '۰')}`
}

type Props = {
  id?: string
  value: string
  onChange: (isoDate: string) => void
  required?: boolean
  disabled?: boolean
}

export default function JalaliDatePicker({ id, value, onChange, required, disabled }: Props) {
  const [isOpen, setOpen] = useState(false)
  const [requiredError, setRequiredError] = useState(false)
  const requiredErrorId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(fromIso(value || localTodayISO())))
  const container = useRef<HTMLDivElement>(null)
  const pendingFocusDate = useRef<string | null>(null)
  useEffect(() => {
    if (value) {
      setVisibleMonth(monthStart(fromIso(value)))
      setRequiredError(false)
    }
  }, [value])
  useEffect(() => {
    if (!isOpen) return
    function onPointerDown(event: PointerEvent) {
      if (container.current && !container.current.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown) }
  }, [isOpen])


  useEffect(() => {
    const targetIso = pendingFocusDate.current
    if (!targetIso) return

    const target = container.current?.querySelector<HTMLButtonElement>(
      `button[data-iso="${targetIso}"]`
    )

    if (target) {
      target.focus()
      pendingFocusDate.current = null
    }
  }, [visibleMonth])

  function handleDayKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    dayDate: Date
  ) {
    const offsets: Record<string, number> = {
      ArrowLeft: 1,
      ArrowRight: -1,
      ArrowUp: -7,
      ArrowDown: 7,
    }

    const offset = offsets[event.key]
    if (offset === undefined) return

    event.preventDefault()

    const targetDate = plusDays(dayDate, offset)
    const targetIso = iso(targetDate)
    const current = parts(visibleMonth)
    const target = parts(targetDate)

    if (
      current.year === target.year &&
      current.month === target.month
    ) {
      container.current
        ?.querySelector<HTMLButtonElement>(
          `button[data-iso="${targetIso}"]`
        )
        ?.focus()
      return
    }

    pendingFocusDate.current = targetIso
    setVisibleMonth(monthStart(targetDate))
  }

  const start = monthStart(visibleMonth)
  const { year, month } = parts(start)
  const offset = (start.getUTCDay() + 1) % 7 // Saturday first
  const end = nextMonth(start)
  const count = Math.round((end.getTime() - start.getTime()) / 86400000)
  return <div className="relative min-w-[180px]" ref={container}>
    <button aria-expanded={isOpen} aria-haspopup="dialog" aria-required={required || undefined} aria-invalid={requiredError || undefined} aria-describedby={requiredError ? requiredErrorId : undefined} ref={triggerRef} className="flex min-h-[46px] w-full cursor-pointer items-center justify-between rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" disabled={disabled} id={id} onClick={() => setOpen(!isOpen)} type="button">
      <span>{value ? displayJalaliISO(value) : 'انتخاب تاریخ'}</span><span aria-hidden="true">▦</span>
    </button>
    {required && (
      <input
        aria-hidden="true"
        className="pointer-events-none absolute h-px w-px opacity-0"
        disabled={disabled}
        onChange={() => {}}
        onInvalid={(event) => {
          event.preventDefault()
          setRequiredError(true)
          triggerRef.current?.focus()
        }}
        required
        tabIndex={-1}
        type="text"
        value={value}
      />
    )}
    {requiredError && required && !disabled && (
      <p
        className="mt-2 mb-0 text-xs text-negative"
        id={requiredErrorId}
        role="alert"
      >
        انتخاب تاریخ الزامی است.
      </p>
    )}
    {isOpen && <div aria-label="تقویم شمسی" className="absolute top-[calc(100%+5px)] right-0 z-30 w-[292px] max-w-[calc(100vw-32px)] rounded-xl border border-[#d9dfe2] bg-white p-3 shadow-[0_12px_36px_#1b3c4a22]" dir="rtl" role="dialog">
      <div className="mb-2 flex items-center justify-between">
        <button aria-label="ماه قبل" className="min-h-[34px] cursor-pointer rounded-[7px] border-0 bg-transparent text-ink h-[34px] w-[34px] text-2xl hover:bg-[#e5f2f4]" onClick={() => setVisibleMonth(previousMonth(start))} type="button">‹</button>
        <strong>{monthNames[month - 1]} {fa(year)}</strong>
        <button aria-label="ماه بعد" className="min-h-[34px] cursor-pointer rounded-[7px] border-0 bg-transparent text-ink h-[34px] w-[34px] text-2xl hover:bg-[#e5f2f4]" onClick={() => setVisibleMonth(nextMonth(start))} type="button">›</button>
      </div>
      <div className="grid grid-cols-7 items-center gap-[2px] text-center">
        {weekdays.map((d, index) => <span className="py-2 text-xs text-[#65727b]" key={index}>{d}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}
        {Array.from({ length: count }, (_, i) => {
          const dayDate = plusDays(start, i)
          const dayIso = iso(dayDate)
          return <button aria-label={`${fa(i + 1)} ${monthNames[month - 1]} ${fa(year)}`} aria-pressed={dayIso === value} className={`min-h-[34px] cursor-pointer rounded-[7px] border-0 ${dayIso === value ? 'bg-[#206c80] text-white' : 'bg-transparent text-ink hover:bg-[#e5f2f4]'}`} data-iso={dayIso} key={dayIso} onKeyDown={(event) => handleDayKeyDown(event, dayDate)} onClick={() => { onChange(dayIso); setOpen(false) }} type="button">{fa(i + 1)}</button>
        })}
      </div>
      <button className="mt-[6px] min-h-[34px] cursor-pointer rounded-[7px] border-0 bg-transparent px-[10px] py-1 text-[#206c80]" onClick={() => { onChange(localTodayISO()); setOpen(false) }} type="button">امروز</button>
    </div>}
  </div>
}
