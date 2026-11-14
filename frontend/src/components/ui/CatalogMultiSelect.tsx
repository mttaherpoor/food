import { Minus, Plus, Trash2 } from 'lucide-react'

import type { CatalogItem } from '../../api/types'
import { formatMoney } from '../../utils/format'

export type CatalogQuantities = Record<number, number>

type Props = {
  label: string
  items: CatalogItem[]
  quantities: CatalogQuantities
  onChange: (quantities: CatalogQuantities) => void
  disabled?: boolean
}

export default function CatalogMultiSelect({
  label,
  items,
  quantities,
  onChange,
  disabled = false,
}: Props) {
  function updateQuantity(id: number, quantity: number) {
    const next = { ...quantities }

    if (quantity <= 0) {
      delete next[id]
    } else {
      next[id] = Math.min(99, Math.floor(quantity))
    }

    onChange(next)
  }

  const selectedCount = items.filter(
    (item) => (quantities[item.id] ?? 0) > 0,
  ).length

  return (
    <fieldset
      disabled={disabled}
      className="min-w-0 rounded-xl border border-line p-2.5 sm:p-3"
    >
      <legend className="px-2 text-sm font-semibold text-ink">
        {label}
      </legend>

      {items.length === 0 ? (
        <p className="m-0 py-3 text-sm text-muted">
          موردی برای انتخاب وجود ندارد.
        </p>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted">
              همه گزینه‌ها ({items.length})
            </span>

            <span className="text-xs text-muted">
              انتخاب‌شده: {selectedCount}
            </span>
          </div>

          <div
            role="region"
            aria-label={`فهرست ${label}`}
            className="max-h-[clamp(112px,22dvh,220px)] min-h-0 space-y-2 overflow-y-auto overscroll-y-contain pe-1"
          >
            {items.map((item) => {
              const quantity = quantities[item.id] ?? 0
              const isSelected = quantity > 0

              return (
                <div
                  key={item.id}
                  className={[
                    'min-w-0 rounded-lg border p-2 transition-colors',
                    isSelected
                      ? 'border-accent bg-raised'
                      : 'border-line bg-surface',
                  ].join(' ')}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {item.image_data?.url && (
                      <img
                        src={item.image_data.url}
                        alt={item.image_data.alt}
                        loading="lazy"
                        className="h-10 w-10 shrink-0 rounded-md object-cover"
                      />
                    )}

                    <div className="min-w-[100px] flex-1">
                      <p className="m-0 whitespace-normal text-sm font-semibold leading-5 text-ink">
                        {item.name}
                      </p>

                      <p className="m-0 mt-0.5 text-xs text-muted">
                        {formatMoney(item.price)}
                      </p>
                    </div>

                    {isSelected ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label={`کاهش ${label} ${item.name}`}
                          disabled={disabled || quantity <= 1}
                          onClick={() =>
                            updateQuantity(item.id, quantity - 1)
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-raised disabled:opacity-40"
                        >
                          <Minus size={14} aria-hidden="true" />
                        </button>

                        <output
                          aria-label={`تعداد ${label} ${item.name}`}
                          className="min-w-5 text-center text-sm font-semibold tabular-nums text-ink"
                        >
                          {quantity}
                        </output>

                        <button
                          type="button"
                          aria-label={`افزایش تعداد ${label} ${item.name}`}
                          disabled={disabled || quantity >= 99}
                          onClick={() =>
                            updateQuantity(item.id, quantity + 1)
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-raised disabled:opacity-40"
                        >
                          <Plus size={14} aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          aria-label={`حذف ${label} ${item.name}`}
                          title={`حذف ${item.name}`}
                          disabled={disabled}
                          onClick={() => updateQuantity(item.id, 0)}
                          className="ms-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-label={`افزودن ${label} ${item.name}`}
                        title={`افزودن ${item.name}`}
                        disabled={disabled}
                        onClick={() => updateQuantity(item.id, 1)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-accent transition-colors hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
                      >
                        <Plus size={18} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </fieldset>
  )
}
