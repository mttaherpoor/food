import { useState, useEffect } from 'react'
import { api } from '../api/client'
import type { Reservation } from '../api/types'
import EmptyState from '../components/ui/EmptyState'
import ErrorMessage from '../components/ui/ErrorMessage'
import LoadingRows from '../components/ui/LoadingRows'
import { formatDate } from '../utils/date'
import { getApiMessage } from '../utils/errors'
import { formatMoney } from '../utils/format'

export default function HistoryPage() {
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
