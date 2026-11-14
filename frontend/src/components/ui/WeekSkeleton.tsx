import { useEffect, useState } from 'react'

const DAYS = Array.from({ length: 6 }, (_, index) => index)

const block = 'rounded-md bg-raised motion-safe:animate-pulse'

function SkeletonDayRow() {
  return (
    <div
      aria-hidden="true"
      data-testid="week-skeleton-row"
      className="grid min-h-[84px] grid-cols-[minmax(120px,0.8fr)_minmax(190px,1.55fr)_minmax(100px,0.7fr)_minmax(120px,auto)] items-center gap-[18px] border-b border-line px-1 py-[13px] max-[900px]:grid-cols-[minmax(105px,0.7fr)_minmax(160px,1.3fr)_minmax(85px,0.6fr)_auto] max-[900px]:gap-[10px] max-[680px]:min-h-[112px] max-[680px]:grid-cols-[minmax(0,1fr)_auto] max-[680px]:gap-x-3 max-[680px]:gap-y-2 max-[680px]:px-[2px] max-[680px]:py-[14px]"
    >
      <div className="flex min-w-0 flex-col gap-2 max-[680px]:col-start-1 max-[680px]:row-start-1">
        <span className={`${block} h-4 w-16 max-w-full`} />
        <span className={`${block} h-3 w-24 max-w-full`} />
      </div>

      <div className="flex min-w-0 items-center gap-3 max-[680px]:col-span-2 max-[680px]:row-start-2">
        <span className={`${block} h-14 w-14 shrink-0 rounded-lg`} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className={`${block} h-4 w-3/5`} />
          <span className={`${block} h-3 w-2/5`} />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2 max-[680px]:col-start-1 max-[680px]:row-start-3">
        <span className={`${block} h-4 w-20 max-w-full`} />
        <span className={`${block} h-3 w-14 max-w-full`} />
      </div>

      <div className="flex items-center justify-end max-[680px]:col-start-2 max-[680px]:row-start-3">
        <span className={`${block} h-9 w-28 max-w-full rounded-lg`} />
      </div>
    </div>
  )
}

export default function WeekSkeleton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(true)
    }, 160)

    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div
      role="status"
      aria-label="در حال بارگذاری برنامه هفتگی"
      aria-busy="true"
      className="border-t border-line"
    >
      <span className="sr-only">در حال دریافت برنامه غذایی هفته…</span>

      <div
        data-testid="week-skeleton-content"
        className={`transition-opacity duration-200 motion-reduce:transition-none ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {DAYS.map((day) => (
          <SkeletonDayRow key={day} />
        ))}
      </div>
    </div>
  )
}
