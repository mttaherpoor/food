import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { api, apiClient } from '../api/client'
import type { DailyReport } from '../api/types'
import EmptyState from '../components/ui/EmptyState'
import ErrorMessage from '../components/ui/ErrorMessage'
import JalaliDatePicker from '../components/ui/JalaliDatePicker'
import { jalaliMonthStartISO } from '../components/ui/JalaliDatePicker'
import { buttonClass } from '../components/ui/buttonStyles'
import { dateToIso, formatDate } from '../utils/date'
import { getApiMessage } from '../utils/errors'
import { formatMoney } from '../utils/format'

export default function ReportPage() {
  const today = dateToIso(new Date())
  const firstDay = jalaliMonthStartISO(today)
  const [fromDate, setFromDate] = useState(firstDay)
  const [toDate, setToDate] = useState(today)
  const [rows, setRows] = useState<DailyReport[]>([])
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    let active = true

    api<DailyReport[]>(`/reports/daily?from=${firstDay}&to=${today}`)
      .then((reportRows) => {
        if (!active) return
        setRows(reportRows)
        setLoaded(true)
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
  }, [firstDay, today])

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
    <form className="flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-line bg-surface p-[17px] max-[680px]:flex-col max-[680px]:items-stretch" onSubmit={(event) => void loadReport(event)}>
      <fieldset className="min-w-[180px] border-0 p-0 max-[680px]:min-w-0"><legend className="mb-2 text-sm font-semibold text-ink">از تاریخ</legend><JalaliDatePicker onChange={setFromDate} required value={fromDate} /></fieldset>
      <fieldset className="min-w-[180px] border-0 p-0 max-[680px]:min-w-0"><legend className="mb-2 text-sm font-semibold text-ink">تا تاریخ</legend><JalaliDatePicker onChange={setToDate} required value={toDate} /></fieldset>
      <button className={buttonClass('primary', '')} disabled={loading} type="submit">{loading ? 'در حال دریافت…' : 'نمایش گزارش'}</button>
      <button className={buttonClass('neutral', '')} onClick={() => void downloadReport()} type="button">خروجی Excel (شمسی)</button>
    </form>
    {error && <ErrorMessage message={error} onRetry={() => void loadReport()} />}
    {loaded && !error && <>
      <div className="my-[18px] grid grid-cols-2 gap-[13px] max-[680px]:gap-2">
        <div className="grid gap-[5px] rounded-[11px] border border-line bg-surface p-[17px] max-[680px]:p-3">
          <span className="text-xs text-muted">رزرو فعال در این بازه</span>
          <strong className="text-[23px] max-[680px]:text-[17px]">{new Intl.NumberFormat('fa-IR').format(reserved)}</strong>
        </div>
        <div className="grid gap-[5px] rounded-[11px] border border-line bg-surface p-[17px] max-[680px]:p-3">
          <span className="text-xs text-muted">جمع مبالغ</span>
          <strong className="text-[23px] max-[680px]:text-[17px]">{formatMoney(total)}</strong>
        </div>
      </div>
      {rows.length === 0 ? <EmptyState title="برای این بازه منویی ثبت نشده" detail="تاریخ دیگری را انتخاب کن." /> : <div className="max-w-full overflow-x-auto rounded-[10px] border border-line bg-surface"><table className="w-full min-w-[680px] border-collapse text-right text-[13px] whitespace-nowrap [&_th]:border-b [&_th]:border-line [&_th]:bg-raised [&_th]:px-[14px] [&_th]:py-[13px] [&_th]:font-semibold [&_th]:text-muted [&_td]:border-b [&_td]:border-line [&_td]:px-[14px] [&_td]:py-[13px]"><thead><tr><th>تاریخ</th><th>غذا</th><th>رزرو</th><th>لغو</th><th>تعداد غذا</th><th>جمع (تومان)</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.date}-${row.food}`}><td>{formatDate(row.date)}</td><td>{row.food}</td><td>{new Intl.NumberFormat('fa-IR').format(row.reserved_count)}</td><td>{new Intl.NumberFormat('fa-IR').format(row.cancelled_count)}</td><td>{new Intl.NumberFormat('fa-IR').format(row.food_quantity)}</td><td>{new Intl.NumberFormat('fa-IR').format(row.total_toman)}</td></tr>)}</tbody></table></div>}
    </>}
  </section>
}
