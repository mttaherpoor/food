import { Minus, Plus } from 'lucide-react'

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

  const total = items.reduce(
    (sum, item) => sum + item.price * (quantities[item.id] ?? 0),
    0,
  )

  return (
    <fieldset
      className="min-w-0 rounded-xl border border-line p-3"
      disabled={disabled}
    >
      <legend className="px-2 text-sm font-semibold text-ink">
        {label}
      </legend>

      {items.length === 0 ? (
        <p className="m-0 py-3 text-xs text-muted">
          موردی برای انتخاب وجود ندارد.
        </p>
      ) : (
        <div className="divide-y divide-line">
          {items.map((item) => {
            const quantity = quantities[item.id] ?? 0
            const imageUrl = item.image_data?.url

            return (
              <div
                key={item.id}
                className="flex min-w-0 items-center gap-3 py-3"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-raised">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={item.image_data.alt}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="h-full w-full bg-raised"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-semibold text-ink">
                    {item.name}
                  </p>
                  <p className="mt-1 mb-0 text-xs text-muted">
                    {formatMoney(item.price)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    aria-label={`کاهش ${label} ${item.name}`}
                    disabled={disabled || quantity === 0}
                    onClick={() => updateQuantity(item.id, quantity - 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink disabled:opacity-40"
                  >
                    <Minus size={15} aria-hidden="true" />
                  </button>

                  <output
                    aria-label={`تعداد ${label} ${item.name}`}
                    className="min-w-5 text-center text-sm font-semibold tabular-nums"
                  >
                    {quantity}
                  </output>

                  <button
                    type="button"
                    aria-label={`افزودن ${label} ${item.name}`}
                    disabled={disabled || quantity >= 99}
                    onClick={() => updateQuantity(item.id, quantity + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink disabled:opacity-40"
                  >
                    <Plus size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-line pt-3 text-xs">
        <span className="text-muted">جمع {label}</span>
        <strong className="text-ink">{formatMoney(total)}</strong>
      </div>
    </fieldset>
  )
}
