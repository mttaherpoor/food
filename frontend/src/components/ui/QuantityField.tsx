import { useState } from 'react'

export default function QuantityField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const displayedValue = draft ?? String(value)

  function changeQuantity(next: number) {
    const safeValue = Math.max(1, next)
    setDraft(null)
    onChange(safeValue)
  }

  return (
    <div className="flex flex-col gap-2 text-sm font-semibold text-[#34393c] dark:text-ink">
      <label htmlFor={`quantity-${label}`}>{label}</label>
      <div className="flex w-fit max-w-full items-center gap-2" dir="ltr">
        <button
          aria-label={`کاهش ${label}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-xl text-ink hover:bg-raised disabled:opacity-40"
          disabled={value <= 1}
          onClick={() => changeQuantity(value - 1)}
          type="button"
        >
          −
        </button>
        <input
          className="h-11 w-16 rounded-lg border border-line bg-surface px-1 text-center text-ink"
          id={`quantity-${label}`}
          inputMode="numeric"
          min={1}
          onBlur={() => setDraft(null)}
          onChange={(event) => {
            const next = event.target.value
            if (!/^\d*$/.test(next)) return

            setDraft(next)

            const parsed = Number(next)
            if (next !== '' && Number.isSafeInteger(parsed) && parsed >= 1) {
              onChange(parsed)
            }
          }}
          type="number"
          value={displayedValue}
        />
        <button
          aria-label={`افزایش ${label}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-xl text-ink hover:bg-raised"
          onClick={() => changeQuantity(value + 1)}
          type="button"
        >
          +
        </button>
      </div>
    </div>
  )
}
