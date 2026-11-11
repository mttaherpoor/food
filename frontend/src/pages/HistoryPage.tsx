import { useEffect, useState } from 'react'

import { api } from '../api/client'
import type { Reservation, ReservationItem } from '../api/types'
import EmptyState from '../components/ui/EmptyState'
import ErrorMessage from '../components/ui/ErrorMessage'
import LoadingRows from '../components/ui/LoadingRows'
import { formatDate } from '../utils/date'
import { getApiMessage } from '../utils/errors'
import { formatMoney } from '../utils/format'

const numberFormatter = new Intl.NumberFormat('fa-IR')
const dateTimeFormatter = new Intl.DateTimeFormat('fa-IR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

type HistoricalProduct = {
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

function historicalProducts(
  item: ReservationItem,
  category: 'side' | 'drink',
): HistoricalProduct[] {
  const entries = category === 'side'
    ? item.side_items
    : item.drink_items

  // The new API returns arrays, including empty arrays.
  // Legacy fallback applies only when the arrays are absent.
  if (entries !== undefined && entries !== null) {
    return entries.map((entry) => ({
      name: category === 'side'
        ? 'side_name' in entry ? entry.side_name : ''
        : 'drink_name' in entry ? entry.drink_name : '',
      quantity: entry.quantity,
      unitPrice: entry.unit_price,
      totalPrice: entry.total_price,
    }))
  }

  const name = category === 'side' ? item.side_name : item.drink_name
  const quantity = category === 'side'
    ? item.side_quantity
    : item.drink_quantity
  const totalPrice = category === 'side'
    ? item.side_price
    : item.drink_price

  if (!name || quantity <= 0) return []

  return [{
    name,
    quantity,
    unitPrice: totalPrice / quantity,
    totalPrice,
  }]
}

function ReservationVersion({
  item,
}: {
  item: ReservationItem
}) {
  const sides = historicalProducts(item, 'side')
  const drinks = historicalProducts(item, 'drink')

  return (
    <li className="min-w-0 border-t border-line py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <time className="text-xs text-muted">
            {dateTimeFormatter.format(new Date(item.datetime_created))}
          </time>
          <span className={
            item.is_cancelled
              ? 'text-xs font-semibold text-negative'
              : 'text-xs font-semibold text-positive'
          }>
            {item.is_cancelled ? 'لغو رزرو' : 'نسخه ثبت‌شده'}
          </span>
        </div>
        <strong className="text-sm text-ink">
          {formatMoney(item.total_price)}
        </strong>
      </div>

      {item.is_cancelled ? (
        <div className="mt-3 rounded-xl bg-raised p-3 text-xs text-muted">
          این نسخه، رویداد لغو رزرو است و مبلغ قابل پرداخت ندارد.
          جزئیات سفارش قبلی در نسخه‌های پیشین حفظ شده‌اند.
        </div>
      ) : (
        <div className="mt-3 grid gap-3 rounded-xl bg-raised p-3 text-xs">
        {!item.is_current && (
          <>
        <div className="flex flex-wrap justify-between gap-2">
          <span className="text-muted">ساختمان تحویل</span>
          <strong className="text-ink">
            {item.building_number_snapshot
              ? `ساختمان ${item.building_number_snapshot}`
              : item.building != null
                ? `ساختمان ${item.building}`
                : 'ثبت نشده'}
          </strong>
        </div>

        <div className="flex flex-wrap justify-between gap-2">
          <span className="text-muted">
            غذای اصلی × {numberFormatter.format(item.food_quantity)}
          </span>
          <strong className="text-ink">
            {formatMoney(item.food_price * item.food_quantity)}
          </strong>
        </div>

          </>
        )}

        {sides.length > 0 && (
          <div className="grid gap-2 border-t border-line pt-3">
            <strong className="text-ink">پیش‌غذاها</strong>
            {sides.map((side, index) => (
              <div
                className="flex flex-wrap justify-between gap-2"
                key={`side-${index}`}
              >
                <span className="text-muted">
                  {side.name} × {numberFormatter.format(side.quantity)}
                  <span className="ms-2 opacity-75">
                    ({formatMoney(side.unitPrice)} هر واحد)
                  </span>
                </span>
                <strong className="text-ink">
                  {formatMoney(side.totalPrice)}
                </strong>
              </div>
            ))}
          </div>
        )}

        {drinks.length > 0 && (
          <div className="grid gap-2 border-t border-line pt-3">
            <strong className="text-ink">نوشیدنی‌ها</strong>
            {drinks.map((drink, index) => (
              <div
                className="flex flex-wrap justify-between gap-2"
                key={`drink-${index}`}
              >
                <span className="text-muted">
                  {drink.name} × {numberFormatter.format(drink.quantity)}
                  <span className="ms-2 opacity-75">
                    ({formatMoney(drink.unitPrice)} هر واحد)
                  </span>
                </span>
                <strong className="text-ink">
                  {formatMoney(drink.totalPrice)}
                </strong>
              </div>
            ))}
          </div>
        )}

        {sides.length === 0 && drinks.length === 0 && (
          <p className="m-0 border-t border-line pt-3 text-muted">
            بدون پیش‌غذا و نوشیدنی
          </p>
        )}
        </div>
      )}
    </li>
  )
}

type MonthGroup = {
  key: number
  label: string
  reservations: Reservation[]
  foodCount: number
  foodAmount: number
  sideAmount: number
  drinkAmount: number
  totalAmount: number
}

const monthKeyFormatter = new Intl.DateTimeFormat(
  'en-US-u-ca-persian',
  { year: 'numeric', month: 'numeric' },
)

const monthLabelFormatter = new Intl.DateTimeFormat(
  'fa-IR-u-ca-persian',
  { year: 'numeric', month: 'long' },
)

function dateFromIso(value: string): Date {
  return new Date(`${value}T12:00:00`)
}

function monthInfo(date: string) {
  const value = dateFromIso(date)
  const parts = monthKeyFormatter.formatToParts(value)

  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error('Invalid Persian calendar date')
  }

  return {
    key: year * 100 + month,
    label: monthLabelFormatter.format(value),
  }
}

function productTotal(
  item: ReservationItem,
  category: 'side' | 'drink',
): number {
  const entries = category === 'side'
    ? item.side_items
    : item.drink_items

  if (entries != null) {
    return entries.reduce((sum, entry) => sum + entry.total_price, 0)
  }

  return category === 'side' ? item.side_price : item.drink_price
}

function groupByPersianMonth(reservations: Reservation[]): MonthGroup[] {
  const groups = new Map<number, MonthGroup>()

  const sorted = [...reservations].sort(
    (a, b) =>
      b.menu_date.localeCompare(a.menu_date) ||
      b.id - a.id,
  )

  for (const reservation of sorted) {
    const { key, label } = monthInfo(reservation.menu_date)

    let group = groups.get(key)

    if (!group) {
      group = {
        key,
        label,
        reservations: [],
        foodCount: 0,
        foodAmount: 0,
        sideAmount: 0,
        drinkAmount: 0,
        totalAmount: 0,
      }
      groups.set(key, group)
    }

    group.reservations.push(reservation)

    const item = reservation.current_item

    if (
      reservation.status !== 'res' ||
      !item ||
      item.is_cancelled
    ) {
      continue
    }

    group.foodCount += item.food_quantity
    group.foodAmount += item.food_price * item.food_quantity
    group.sideAmount += productTotal(item, 'side')
    group.drinkAmount += productTotal(item, 'drink')
    group.totalAmount += reservation.total_price
  }

  return Array.from(groups.values()).sort((a, b) => b.key - a.key)
}

function MonthlyMetric({
  label,
  value,
  count = false,
}: {
  label: string
  value: number
  count?: boolean
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <strong className="mt-1 block whitespace-nowrap text-sm font-semibold text-ink">
        {count ? numberFormatter.format(value) : formatMoney(value)}
      </strong>
    </div>
  )
}

export default function HistoryPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    api<Reservation[]>('/reservations')
      .then((data) => {
        if (active) setReservations(data)
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
  }, [])

  const months = groupByPersianMonth(reservations)

  return (
    <section className="min-w-0" aria-labelledby="history-title">
      <header className="mb-6">
        <p className="mb-2 text-xs font-bold text-accent">
          حساب من
        </p>
        <h1
          className="m-0 text-3xl font-bold text-ink"
          id="history-title"
        >
          سوابق رزرو
        </h1>
        <p className="mt-2 text-sm leading-7 text-muted">
          خلاصه ماهانه و جزئیات رزروها با قیمت‌های ثبت‌شده
        </p>
      </header>

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <LoadingRows />
      ) : months.length === 0 && !error ? (
        <EmptyState
          title="هنوز رزروی ثبت نکرده‌ای"
          detail="از صفحه رزرو هفته می‌توانی غذای روزها را انتخاب کنی."
        />
      ) : (
        <div className="grid gap-4">
          {months.map((month) => (
            <details
              className="group min-w-0 overflow-hidden rounded-2xl border border-line bg-white"
              key={month.key}
            >
              <summary
                aria-label="باز کردن خلاصه ماه"
                className="cursor-pointer list-none p-4 marker:hidden sm:p-5 [&::-webkit-details-marker]:hidden"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="m-0 text-lg font-bold text-ink">
                      {month.label}
                    </h2>
                    <p className="mt-1 mb-0 text-xs text-muted">
                      {numberFormatter.format(
                        month.reservations.filter(
                          (reservation) =>
                            reservation.status === 'res' &&
                            reservation.current_item != null &&
                            !reservation.current_item.is_cancelled &&
                            reservation.total_price > 0,
                        ).length,
                      )} رزرو فعال
                    </p>
                  </div>

                  <div className="min-w-0 text-end">
                    <p className="m-0 text-xs text-muted">جمع کل ماه</p>
                    <strong className="mt-1 block whitespace-nowrap text-sm font-bold text-ink sm:text-base">
                      {formatMoney(month.totalAmount)}
                    </strong>
                  </div>
                </div>
              </summary>

              <div className="border-t border-line px-4 py-4 sm:px-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0 text-center">
                    <MonthlyMetric
                      label="غذا"
                      value={month.foodAmount}
                    />
                  </div>

                  <div className="min-w-0 border-s border-line ps-3 text-center">
                    <MonthlyMetric
                      label="مخلفات"
                      value={month.sideAmount + month.drinkAmount}
                    />
                  </div>
                </div>

                <details className="mt-4 border-t border-line pt-3">
                  <summary className="cursor-pointer py-2 text-center text-xs font-semibold text-accent">
                    مشاهده رزروهای ماه
                  </summary>

                  <div className="divide-y divide-line">
                {month.reservations.map((reservation) => (
                  <article
                    className="min-w-0 py-5"
                    key={reservation.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-2">
                        <span className="text-xs text-muted">
                          {formatDate(reservation.menu_date)}
                        </span>
                        <strong className="text-sm text-ink">
                          {reservation.food_name}
                        </strong>
                        <span className={
                          reservation.status === 'res'
                            ? 'text-xs font-semibold text-positive'
                            : 'text-xs font-semibold text-muted'
                        }>
                          {reservation.status === 'res'
                            ? 'رزرو فعال'
                            : 'لغو شده'}
                        </span>
                      </div>

                      <div className="flex min-w-0 flex-col items-start gap-2">
                        <strong className="whitespace-nowrap text-sm text-ink">
                          {formatMoney(reservation.total_price)}
                        </strong>

                        {reservation.status === 'res' &&
                          reservation.current_item &&
                          !reservation.current_item.is_cancelled && (
                            <div className="grid gap-1 rounded-lg bg-raised px-3 py-2 text-xs text-muted">
                              <span>
                                ساختمان {reservation.current_item.building_number_snapshot
                                  ?? reservation.current_item.building
                                  ?? 'ثبت‌نشده'}
                              </span>
                              <span>
                                غذای اصلی: {formatMoney(
                                  reservation.current_item.food_price *
                                  reservation.current_item.food_quantity,
                                )}
                              </span>
                            </div>
                          )}
                      </div>
                    </div>

                    <details className="mt-3 rounded-xl border border-line px-3 py-3">
                      <summary className="cursor-pointer text-sm font-semibold text-accent">
                        جزئیات و سوابق (
                        {numberFormatter.format(reservation.history.length)} نسخه)
                      </summary>

                      <ol className="m-0 mt-3 list-none p-0">
                        {reservation.history.map((item) => (
                          <ReservationVersion item={item} key={item.id} />
                        ))}
                      </ol>
                    </details>
                  </article>
                ))}
                  </div>
                </details>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}
