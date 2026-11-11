import { useId, useRef } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import type { CatalogItem } from '../../api/types'
import { formatMoney } from '../../utils/format'

type FoodItem = CatalogItem & {
  container_price: number
  total_price: number
}

type Props = {
  foods: FoodItem[]
  value: string
  onChange: (value: string) => void
}

export default function FoodPicker({
  foods,
  value,
  onChange,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  const selected = foods.find(
    (food) => String(food.id) === value,
  )

  function openDialog() {
    if (!foods.length) return
    dialogRef.current?.showModal()
  }

  function selectFood(id: number) {
    onChange(String(id))
    dialogRef.current?.close()
  }

  return (
    <>
      <button
        type="button"
        disabled={!foods.length}
        aria-haspopup="dialog"
        onClick={openDialog}
        className="flex min-h-[46px] w-full cursor-pointer items-center justify-between gap-3 rounded-[9px] border border-[#d9dfe2] bg-white dark:border-line dark:bg-surface px-3 py-2 text-right text-sm text-ink hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="min-w-0 flex-1">
          {selected ? (
            <span className="flex flex-col gap-1">
              <strong>{selected.name}</strong>
              <span className="text-xs text-muted">
                {formatMoney(selected.total_price)}
              </span>
            </span>
          ) : (
            'انتخاب غذای روز'
          )}
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        dir="rtl"
        className="fixed inset-0 m-auto max-h-[min(75dvh,620px)] w-[calc(100vw-32px)] max-w-[420px] overflow-hidden rounded-2xl border border-[#cbdde2] bg-white dark:border-line dark:bg-surface p-0 text-ink shadow-[0_20px_70px_#102a3555] backdrop:bg-[#102a35]/50 open:flex open:flex-col"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-[#e4f0f3] dark:bg-raised px-4 py-4">
          <h2
            id={titleId}
            className="m-0 text-base font-bold text-[#164c5a] dark:text-ink"
          >
            انتخاب غذای روز
          </h2>

          <button
            type="button"
            aria-label="بستن پنجره انتخاب غذا"
            onClick={() => dialogRef.current?.close()}
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border-0 bg-white/70 text-[#164c5a] hover:bg-white dark:bg-surface dark:text-ink dark:hover:bg-active"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid gap-2">
            {foods.map((food) => {
              const active = String(food.id) === value

              return (
                <button
                  key={food.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectFood(food.id)}
                  className={`flex min-h-[68px] w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-right transition-colors ${
                    active
                      ? 'border-[#206c80] bg-[#e4f0f3] dark:border-accent dark:bg-accent-soft dark:text-ink'
                      : 'border-[#dce5e8] bg-white hover:bg-[#f4f8f9] dark:border-line dark:bg-surface dark:text-ink dark:hover:bg-raised'
                  }`}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <strong className="text-sm">{food.name}</strong>
                    <span className="text-xs leading-5 text-muted">
                      غذا: {formatMoney(food.price)}
                      {' · '}
                      ظرف: {formatMoney(food.container_price)}
                    </span>
                  </span>

                  {active && (
                    <Check
                      aria-hidden="true"
                      size={19}
                      className="shrink-0 text-[#206c80] dark:text-accent"
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="shrink-0 border-t border-line bg-[#f4f8f9] dark:bg-raised p-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="min-h-11 w-full cursor-pointer rounded-lg border border-[#cbdde2] bg-white text-sm font-semibold text-[#164c5a] dark:border-line dark:bg-surface dark:text-ink"
          >
            انصراف
          </button>
        </div>
      </dialog>
    </>
  )
}
