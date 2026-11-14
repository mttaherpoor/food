import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { CatalogItem } from '../../api/types'
import { formatMoney } from '../../utils/format'
import { getApiMessage } from '../../utils/errors'

type FoodItem = CatalogItem & {
  container_price: number
  total_price: number
}

type Kind = 'foods' | 'sides' | 'drinks'

type Props = {
  foods: FoodItem[]
  sides: CatalogItem[]
  drinks: CatalogItem[]
  onChanged: (message: string) => Promise<void>
}

export default function CatalogInventory({
  foods,
  sides,
  drinks,
  onChanged,
}: Props) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [containerPrice, setContainerPrice] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Release temporary preview URLs after replacement or unmount.
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  const sections: {
    kind: Kind
    title: string
    items: CatalogItem[]
  }[] = [
    { kind: 'foods', title: 'غذاها', items: foods },
    { kind: 'sides', title: 'پیش‌غذاها', items: sides },
    { kind: 'drinks', title: 'نوشیدنی‌ها', items: drinks },
  ]

  function startEdit(kind: Kind, item: CatalogItem) {
    setEditing(`${kind}:${item.id}`)
    setImageFile(null)
    setImagePreview(null)
    setName(item.name)
    setPrice(String(item.price))
    setContainerPrice(
      kind === 'foods'
        ? String((item as FoodItem).container_price)
        : '',
    )
    setError('')
  }

  async function save(kind: Kind, id: number) {
    if (!name.trim() || price.trim() === '') {
      setError('نام و قیمت الزامی هستند.')
      return
    }

    const priceValue = Number(price)
    const containerValue = Number(containerPrice)

    if (
      !Number.isSafeInteger(priceValue) ||
      priceValue < 0 ||
      (kind === 'foods' &&
        (!Number.isSafeInteger(containerValue) || containerValue < 0))
    ) {
      setError('قیمت‌ها باید عدد صحیح و غیرمنفی باشند.')
      return
    }

    setSaving(true)
    setError('')

    try {
      let body: BodyInit

      if (imageFile) {
        const formData = new FormData()
        formData.append('name', name.trim())
        formData.append('price', String(priceValue))
        if (kind === 'foods') {
          formData.append('container_price', String(containerValue))
        }
        formData.append('image', imageFile)
        body = formData
      } else {
        body = JSON.stringify({
          name: name.trim(),
          price: priceValue,
          ...(kind === 'foods'
            ? { container_price: containerValue }
            : {}),
        })
      }

      await api(`/${kind}/${id}`, {
        method: 'PATCH',
        body,
      })

      const itemType = kind === 'foods'
        ? 'غذا'
        : kind === 'sides'
          ? 'پیش‌غذا'
          : 'نوشیدنی'
      const message = `${itemType} «${name.trim()}» با موفقیت تغییر کرد.`
      await onChanged(message)
      setImageFile(null)
      setImagePreview(null)
      setEditing(null)
    } catch (err) {
      setError(getApiMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const normalizedQuery = query.trim().toLocaleLowerCase()

  return (
    <section
      className="col-span-full min-w-0 rounded-xl border border-line bg-surface p-[18px]"
      aria-labelledby="inventory-title"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="inventory-title" className="m-0 text-lg">
            فهرست کاتالوگ
          </h2>
          <p className="mt-2 text-xs text-muted">
            مشاهده، جست‌وجو و ویرایش آیتم‌های موجود
          </p>
        </div>
        <input
          aria-label="جست‌وجوی کاتالوگ"
          className="min-h-11 w-full max-w-[300px] rounded-lg border border-line px-3"
          placeholder="جست‌وجوی نام غذا یا گزینه..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm text-negative">
          {error}
        </p>
      )}

      <div className="grid gap-6">
        {sections.map(({ kind, title, items }) => {
          const filtered = items.filter((item) =>
            item.name.toLocaleLowerCase().includes(normalizedQuery),
          )

          return (
            <details key={kind} className="open:z-30 relative min-w-0 overflow-visible rounded-lg border border-line bg-surface">
              <summary className="cursor-pointer bg-raised px-4 py-4 text-sm font-semibold text-ink hover:bg-active">
                {title} ({filtered.length})
              </summary>
              <div className="px-3 pb-3">

              {filtered.length === 0 ? (
                <p className="text-sm text-muted">
                  موردی برای نمایش پیدا نشد.
                </p>
              ) : (
                <div className="grid gap-2">
                  {filtered.map((item) => {
                    const key = `${kind}:${item.id}`
                    const isEditing = editing === key
                    const food = kind === 'foods'
                      ? item as FoodItem
                      : null

                    return (
                      <div
                        key={key}
                        className="rounded-lg border border-line p-3"
                      >

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <strong className="text-sm">{item.name}</strong>
                            <p className="mt-1 mb-0 text-xs text-muted">
                              قیمت: {formatMoney(item.price)}
                              {food && (
                                <>
                                  {' · '}ظرف: {formatMoney(food.container_price)}
                                  {' · '}مجموع: {formatMoney(food.total_price)}
                                </>
                              )}
                            </p>
                          </div>

                          <button
                            type="button"
                            className="min-h-10 rounded-lg border border-line px-4 text-sm"
                            onClick={() => {
                              if (isEditing) {
                                setEditing(null)
                                setImageFile(null)
                                setImagePreview(null)
                              } else {
                                startEdit(kind, item)
                              }
                            }}
                          >
                            {isEditing ? 'انصراف' : 'ویرایش'}
                          </button>
                        </div>

                        {isEditing && (
                          <form
                            className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2"
                            onSubmit={(event) => {
                              event.preventDefault()
                              void save(kind, item.id)
                            }}
                          >
                            <label className="grid gap-2 text-sm">
                              نام
                              <input
                                className="min-h-11 rounded-lg border border-line px-3"
                                value={name}
                                required
                                onChange={(event) => setName(event.target.value)}
                              />
                            </label>

                            <label className="grid gap-2 text-sm">
                              قیمت (تومان)
                              <input
                                className="min-h-11 rounded-lg border border-line px-3"
                                type="number"
                                min={0}
                                required
                                value={price}
                                onChange={(event) => setPrice(event.target.value)}
                              />
                            </label>

                            {kind === 'foods' && (
                              <label className="grid gap-2 text-sm">
                                قیمت ظرف (تومان)
                                <input
                                  className="min-h-11 rounded-lg border border-line px-3"
                                  type="number"
                                  min={0}
                                  required
                                  value={containerPrice}
                                  onChange={(event) => setContainerPrice(event.target.value)}
                                />
                              </label>
                            )}

                            <div className="grid min-w-0 gap-3 rounded-xl border border-line bg-raised p-3 sm:col-span-2">
                                <span className="text-sm font-semibold text-ink">
                                  تصویر {kind === 'foods' ? 'غذا' : kind === 'sides' ? 'پیش‌غذا' : 'نوشیدنی'}
                                </span>

                                <div className="flex flex-wrap items-center gap-4">
                                  <img
                                    src={imagePreview || item.image_data.url}
                                    alt={`تصویر ${item.name}`}
                                    className="h-24 w-24 rounded-xl border border-line bg-surface object-cover"
                                  />

                                  <div className="min-w-0 flex-1">
                                    <label
                                      htmlFor={`catalog-image-${item.id}`}
                                      className="mb-2 block text-sm text-ink"
                                    >
                                      انتخاب تصویر جدید
                                    </label>
                                    <input
                                      id={`catalog-image-${item.id}`}
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp"
                                      className="block w-full min-w-0 text-xs text-muted file:me-3 file:cursor-pointer file:rounded-lg file:border file:border-line file:bg-white dark:file:bg-active file:px-3 file:py-2 file:text-sm file:text-ink dark:file:text-ink"
                                      onChange={(event) => {
                                        const file = event.target.files?.[0] ?? null
                                        setImageFile(file)
                                        setImagePreview(
                                          file ? URL.createObjectURL(file) : null,
                                        )
                                      }}
                                    />
                                    <p className="mb-0 mt-2 text-xs text-muted">
                                      اگر تصویری انتخاب نکنی، عکس قبلی حفظ می‌شود.
                                    </p>
                                  </div>
                                </div>
                              </div>

                            <div className="flex items-end">
                              <button
                                type="submit"
                                disabled={saving}
                                className="min-h-11 w-full rounded-lg bg-accent dark:text-[var(--accent-contrast)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                {saving ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}
