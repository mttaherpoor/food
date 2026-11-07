import { useEffect, useRef, useState } from 'react'

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
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(fromIso(value)))
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (value) setVisibleMonth(monthStart(fromIso(value)))
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

  const start = monthStart(visibleMonth)
  const { year, month } = parts(start)
  const offset = (start.getUTCDay() + 1) % 7 // Saturday first
  const end = nextMonth(start)
  const count = Math.round((end.getTime() - start.getTime()) / 86400000)
  return <div className="jalali-picker" ref={container}>
    <button aria-expanded={isOpen} aria-haspopup="dialog" className="jalali-input" disabled={disabled} id={id} onClick={() => setOpen(!isOpen)} type="button">
      <span>{value ? displayJalaliISO(value) : 'انتخاب تاریخ'}</span><span aria-hidden="true">▦</span>
    </button>
    {required && <input aria-hidden="true" readOnly required tabIndex={-1} value={value} className="jalali-required" />}
    {isOpen && <div aria-label="تقویم شمسی" className="jalali-calendar" dir="rtl" role="dialog">
      <div className="jalali-calendar-nav">
        <button aria-label="ماه قبل" onClick={() => setVisibleMonth(previousMonth(start))} type="button">‹</button>
        <strong>{monthNames[month - 1]} {fa(year)}</strong>
        <button aria-label="ماه بعد" onClick={() => setVisibleMonth(nextMonth(start))} type="button">›</button>
      </div>
      <div className="jalali-calendar-grid">
        {weekdays.map((d, index) => <span className="jalali-weekday" key={index}>{d}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}
        {Array.from({ length: count }, (_, i) => {
          const dayDate = plusDays(start, i)
          const dayIso = iso(dayDate)
          return <button aria-label={`${fa(i + 1)} ${monthNames[month - 1]} ${fa(year)}`} aria-pressed={dayIso === value} className={dayIso === value ? 'selected' : ''} key={dayIso} onClick={() => { onChange(dayIso); setOpen(false) }} type="button">{fa(i + 1)}</button>
        })}
      </div>
      <button className="jalali-today" onClick={() => { onChange(localTodayISO()); setOpen(false) }} type="button">امروز</button>
    </div>}
  </div>
}
