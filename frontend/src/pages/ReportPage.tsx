import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api, apiClient } from '../api/client'
import EmptyState from '../components/ui/EmptyState'
import ErrorMessage from '../components/ui/ErrorMessage'
import JalaliDatePicker, { jalaliMonthStartISO } from '../components/ui/JalaliDatePicker'
import { buttonClass } from '../components/ui/buttonStyles'
import { dateToIso, formatDate } from '../utils/date'
import { getApiMessage } from '../utils/errors'

type BuildingReportDay = {
  date: string
  food: string
  reserved_count: number
  food_quantity: number
}

type BuildingReport = {
  building_number: string
  reserved_count: number
  days: BuildingReportDay[]
}

type BuildingReportResponse = {
  buildings: BuildingReport[]
}

const numberFormatter = new Intl.NumberFormat('fa-IR')

function number(value: number): string {
  return numberFormatter.format(value)
}

export default function ReportPage() {
  const today = dateToIso(new Date())
  const firstDay = jalaliMonthStartISO(today)

  const [fromDate, setFromDate] = useState(firstDay)
  const [toDate, setToDate] = useState(today)
  const [buildings, setBuildings] = useState<BuildingReport[]>([])
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const requestIdRef = useRef(0)

  const selectedBuilding = buildings.find(
    (building) => building.building_number === selectedNumber,
  )

  const totalReservations = buildings.reduce(
    (sum, building) => sum + building.reserved_count,
    0,
  )

  async function loadReport(event?: FormEvent) {
    event?.preventDefault()
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError('')

    try {
      const query = new URLSearchParams({
        from: fromDate,
        to: toDate,
      })

      const response = await api<BuildingReportResponse>(
        `/reports/daily/buildings?${query.toString()}`,
      )

      if (requestId !== requestIdRef.current) return
      setBuildings(response.buildings)
      setSelectedNumber(null)
      setLoaded(true)
    } catch (loadError) {
      if (requestId === requestIdRef.current) {
        setError(getApiMessage(loadError))
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    let active = true
    const requestId = ++requestIdRef.current

    const query = new URLSearchParams({
      from: firstDay,
      to: today,
    })

    api<BuildingReportResponse>(
      `/reports/daily/buildings?${query.toString()}`,
    )
      .then((response) => {
        if (!active || requestId !== requestIdRef.current) return
        setBuildings(response.buildings)
        setLoaded(true)
      })
      .catch((loadError: unknown) => {
        if (active && requestId === requestIdRef.current) {
          setError(getApiMessage(loadError))
        }
      })
      .finally(() => {
        if (active && requestId === requestIdRef.current) {
          setLoading(false)
        }
      })

    return () => {
      active = false
      if (requestIdRef.current === requestId) {
        requestIdRef.current += 1
      }
    }
  }, [firstDay, today])

  async function downloadReport() {
    setError('')
    setDownloading(true)

    try {
      const response = await apiClient.get<Blob>(
        '/reports/daily/export',
        {
          params: { from: fromDate, to: toDate },
          responseType: 'blob',
        },
      )

      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date())

      const datePart = (type: string) =>
        parts.find((part) => part.type === type)?.value

      const exportDate = `${datePart('year')}-${datePart('month')}-${datePart('day')}`
      link.download = `food-daily-report-${exportDate}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      setError(getApiMessage(downloadError))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section className="min-w-0" aria-labelledby="report-title">
      <header className="mb-6">
        <p className="mb-2 text-xs font-bold text-accent">
          گزارش مدیریتی
        </p>
        <h1
          id="report-title"
          className="m-0 text-[clamp(26px,3vw,34px)] font-bold text-ink"
        >
          گزارش رزرو ساختمان‌ها
        </h1>
        <p className="mt-2 text-sm leading-7 text-muted">
          آمار رزرو هر ساختمان را در بازه دلخواه بررسی کن.
        </p>
      </header>

      <form
        className="flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-line bg-surface p-4 max-[680px]:flex-col max-[680px]:items-stretch"
        onSubmit={(event) => void loadReport(event)}
      >
        <fieldset className="min-w-[180px] border-0 p-0 max-[680px]:min-w-0">
          <legend className="mb-2 text-sm font-semibold text-ink">
            از تاریخ
          </legend>
          <JalaliDatePicker
            onChange={setFromDate}
            required
            value={fromDate}
          />
        </fieldset>

        <fieldset className="min-w-[180px] border-0 p-0 max-[680px]:min-w-0">
          <legend className="mb-2 text-sm font-semibold text-ink">
            تا تاریخ
          </legend>
          <JalaliDatePicker
            onChange={setToDate}
            required
            value={toDate}
          />
        </fieldset>

        <button
          className={buttonClass('primary', '')}
          disabled={loading}
          type="submit"
        >
          {loading ? 'در حال دریافت…' : 'نمایش گزارش'}
        </button>

        <button
          className={buttonClass('neutral', '')}
          disabled={downloading}
          onClick={() => void downloadReport()}
          type="button"
        >
          {downloading ? 'در حال دریافت Excel…' : 'خروجی Excel'}
        </button>
      </form>

      {error && (
        <div className="mt-4">
          <ErrorMessage
            message={error}
            onRetry={() => void loadReport()}
          />
        </div>
      )}

      {loading && !loaded && (
        <p className="mt-5 text-sm text-muted" role="status">
          در حال بارگذاری گزارش ساختمان‌ها…
        </p>
      )}

      {loaded && !error && (
        <div className="mt-5">
          {selectedBuilding ? (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="mb-1 text-sm text-muted">
                    جزئیات روزانه ساختمان
                  </p>
                  <h2 className="m-0 text-2xl font-bold text-ink">
                    ساختمان {selectedBuilding.building_number}
                  </h2>
                </div>

                <button
                  className={buttonClass('neutral', '')}
                  onClick={() => setSelectedNumber(null)}
                  type="button"
                >
                  بازگشت به ساختمان‌ها
                </button>
              </div>

              <div className="mb-4 rounded-xl border border-line bg-surface p-4">
                <span className="text-sm text-muted">
                  مجموع رزروهای فعال در بازه
                </span>
                <p className="mb-0 mt-2 text-3xl font-bold text-ink">
                  {number(selectedBuilding.reserved_count)}
                </p>
              </div>

              <div className="grid gap-3">
                {selectedBuilding.days.map((day) => (
                  <article
                    className="rounded-xl border border-line bg-surface p-4"
                    key={`${day.date}-${day.food}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="mb-2 text-sm font-semibold text-accent">
                          {formatDate(day.date)}
                        </p>
                        <h3 className="m-0 text-lg font-bold text-ink">
                          {day.food}
                        </h3>
                      </div>

                      <div className="rounded-lg bg-raised px-4 py-3 text-center">
                        <strong className="block text-2xl text-ink">
                          {number(day.reserved_count)}
                        </strong>
                        <span className="text-xs text-muted">
                          رزرو فعال
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-line pt-3 text-sm text-muted">
                      تعداد پرس غذا:{' '}
                      <strong className="text-ink">
                        {number(day.food_quantity)}
                      </strong>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="m-0 text-xl font-bold text-ink">
                    ساختمان‌ها
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    برای مشاهده گزارش روزانه، یک ساختمان را انتخاب کن.
                  </p>
                </div>

                <div className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
                  مجموع رزروها:{' '}
                  <strong className="text-ink">
                    {number(totalReservations)}
                  </strong>
                </div>
              </div>

              {buildings.length === 0 ? (
                <EmptyState
                  title="رزروی برای ساختمان‌ها ثبت نشده"
                  detail="در بازه انتخابی، رزرو فعال دارای شماره ساختمان وجود ندارد."
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {buildings.map((building) => (
                    <button
                      aria-label={`مشاهده گزارش ساختمان ${building.building_number}`}
                      className="group flex min-h-[170px] flex-col justify-between rounded-xl border border-line bg-surface p-5 text-right transition-colors hover:border-accent hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      key={building.building_number}
                      onClick={() => setSelectedNumber(building.building_number)}
                      type="button"
                    >
                      <div className="flex w-full items-start justify-between gap-3">
                        <span className="text-lg font-bold text-ink">
                          ساختمان {building.building_number}
                        </span>
                        <span className="rounded-lg bg-raised px-2 py-1 text-xs text-muted">
                          {number(building.days.length)} روز
                        </span>
                      </div>

                      <div className="mt-5 w-full">
                        <strong className="block text-3xl text-ink">
                          {number(building.reserved_count)}
                        </strong>
                        <span className="mt-1 block text-sm text-muted">
                          رزرو فعال در این بازه
                        </span>
                      </div>

                      <span className="mt-4 text-sm font-semibold text-accent">
                        مشاهده جزئیات
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
