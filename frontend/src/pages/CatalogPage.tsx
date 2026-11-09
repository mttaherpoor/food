import FoodPicker from '../components/ui/FoodPicker'
import CatalogInventory from '../features/catalog/CatalogInventory'
import { RefreshCw } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api/client'
import type { CatalogItem } from '../api/types'
import { buttonClass, iconButtonClass } from '../components/ui/buttonStyles'
import { addDays, dateToIso } from '../utils/date'
import { getApiMessage } from '../utils/errors'
import JalaliDatePicker from '../components/ui/JalaliDatePicker'
import ErrorMessage from '../components/ui/ErrorMessage'
import LoadingRows from '../components/ui/LoadingRows'

type CatalogKind = 'foods' | 'sides' | 'drinks'

export default function CatalogPage() {
  const [foods, setFoods] = useState<(CatalogItem & { container_price: number; total_price: number })[]>([])
  const [sides, setSides] = useState<CatalogItem[]>([])
  const [drinks, setDrinks] = useState<CatalogItem[]>([])
  const [foodName, setFoodName] = useState('')
  const [foodPrice, setFoodPrice] = useState('')
  const [containerPrice, setContainerPrice] = useState('')
  const [menuDate, setMenuDate] = useState(dateToIso(addDays(new Date(), 1)))
  const [selectedFood, setSelectedFood] = useState('')
  const [kind, setKind] = useState<CatalogKind>('sides')
  const [itemName, setItemName] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [notice, setNotice] = useState('')
  const [editNotice, setEditNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadCatalog = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const [foodRows, sideRows, drinkRows] = await Promise.all([
        api<(CatalogItem & { container_price: number; total_price: number })[]>('/foods'),
        api<CatalogItem[]>('/sides'),
        api<CatalogItem[]>('/drinks'),
      ])
      setFoods(foodRows)
      setSides(sideRows)
      setDrinks(drinkRows)
      setSelectedFood((value) => value || foodRows[0]?.id.toString() || '')
    } catch (loadError) {
      setError(getApiMessage(loadError))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { void loadCatalog() }, [loadCatalog])

  async function createFood(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    try {
      const created = await api<CatalogItem & { container_price: number }>('/foods', {
        method: 'POST', body: JSON.stringify({ name: foodName.trim(), price: Number(foodPrice), container_price: Number(containerPrice) }),
      })
      setFoodName(''); setFoodPrice(''); setContainerPrice(''); setNotice('غذا به کاتالوگ اضافه شد.')
      await loadCatalog()
      setSelectedFood(created.id.toString())
    } catch (saveError) { setError(getApiMessage(saveError)) }
  }

  async function createCatalogItem(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    const endpoint = kind === 'sides' ? '/sides' : '/drinks'
    try {
      await api(endpoint, { method: 'POST', body: JSON.stringify({ name: itemName.trim(), price: Number(itemPrice) }) })
      setItemName(''); setItemPrice(''); setNotice(kind === 'sides' ? 'ساید اضافه شد.' : 'نوشیدنی اضافه شد.')
      await loadCatalog()
    } catch (saveError) { setError(getApiMessage(saveError)) }
  }

  async function createMenu(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    try {
      await api('/menus', { method: 'POST', body: JSON.stringify({ date: menuDate, food: Number(selectedFood) }) })
      setNotice('منوی این روز ثبت شد.')
    } catch (saveError) { setError(getApiMessage(saveError)) }
  }

  return <section className="min-w-0" aria-labelledby="catalog-title">
    <div className="mb-[25px] flex items-end justify-between gap-[18px] max-[680px]:mb-[18px] max-[680px]:items-start [&_h1]:m-0 [&_h1]:text-[clamp(26px,3vw,34px)] [&_h1]:leading-[1.35] [&_h1]:tracking-[-0.8px] max-[680px]:[&_h1]:text-[27px]"><div><p className="mt-0 mb-2 text-xs font-bold text-accent">ویژهٔ HR</p><h1 id="catalog-title">مدیریت منو</h1><p className="mt-[7px] mb-0 text-sm leading-[1.7] text-muted max-[680px]:max-w-[440px] max-[680px]:text-xs">غذاها و گزینه‌های جانبی را مدیریت و منوی روز را تعیین کن.</p></div><button aria-label="تازه‌سازی کاتالوگ" className={iconButtonClass} onClick={() => void loadCatalog()} type="button"><RefreshCw size={18} /></button></div>
    {editNotice && (
      <p
        role="status"
        aria-live="polite"
        className="mb-[14px] rounded-lg border border-[#e8c976] bg-[#fff5cf] px-4 py-3 text-sm font-medium text-[#805b12]"
      >
        {editNotice}
      </p>
    )}
    {notice && <p className="mb-[14px] rounded-[9px] border border-[#c9e5d7] bg-[#f0faf4] p-[14px] leading-[1.8] text-[#176441]" role="status">{notice}</p>}
    {error && <ErrorMessage message={error} />}
    {loading ? <LoadingRows /> : <div className="grid gap-4">
      <details className="open:z-30 relative group overflow-visible rounded-xl border border-[#cbdde2] bg-white">
        <summary className="cursor-pointer bg-[#e4f0f3] px-5 py-5 text-base font-bold text-[#164c5a] hover:bg-[#d6e9ee]">
          مدیریت منو
        </summary>
        <div className="grid grid-cols-1 gap-3 bg-[#f4f8f9] p-4">
      <details className="open:z-30 relative min-w-0 overflow-visible rounded-xl border border-[#d4e1e5] bg-white">
  <summary className="cursor-pointer border-b border-[#dce7ea] bg-[#edf3f5] px-5 py-4 text-sm font-semibold text-[#274d59] hover:bg-[#e1edf1]">افزودن غذا</summary>
<div className="p-3 pt-0"><section className="min-w-0 rounded-xl border border-line bg-white p-[18px]"><h2 className="mt-0 mb-[15px] text-base">افزودن غذا</h2><form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={(event) => void createFood(event)}><label className="flex flex-col gap-2 mb-[17px] text-sm font-semibold text-[#34393c] !m-0 col-span-full">نام غذا<input className="min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" onChange={(event) => setFoodName(event.target.value)} required value={foodName} /></label><label className="flex flex-col gap-2 mb-[17px] text-sm font-semibold text-[#34393c] !m-0">قیمت غذا (تومان)<input className="min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" min={0} onChange={(event) => setFoodPrice(event.target.value)} required type="number" value={foodPrice} /></label><label className="flex flex-col gap-2 mb-[17px] text-sm font-semibold text-[#34393c] !m-0">قیمت ظرف (تومان)<input className="min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" min={0} onChange={(event) => setContainerPrice(event.target.value)} required type="number" value={containerPrice} /></label><button className={buttonClass('primary', 'col-span-full')} type="submit">افزودن غذا</button></form></section></div>
</details>
      <details className="open:z-30 relative min-w-0 overflow-visible rounded-xl border border-[#d4e1e5] bg-white">
  <summary className="cursor-pointer border-b border-[#dce7ea] bg-[#edf3f5] px-5 py-4 text-sm font-semibold text-[#274d59] hover:bg-[#e1edf1]">ثبت منوی روز</summary>
<div className="p-3 pt-0"><section className="min-w-0 rounded-xl border border-line bg-white p-[18px]"><h2 className="mt-0 mb-[15px] text-base">ثبت منوی روز</h2><form className="grid gap-3" onSubmit={(event) => void createMenu(event)}><label className="flex flex-col gap-2 mb-[17px] text-sm font-semibold text-[#34393c] !m-0">تاریخ<JalaliDatePicker onChange={setMenuDate} required value={menuDate} /></label><label className="flex flex-col gap-2 mb-[17px] text-sm font-semibold text-[#34393c] !m-0">غذای روز<FoodPicker foods={foods} value={selectedFood} onChange={setSelectedFood} /></label><button className={buttonClass('primary', '')} disabled={!foods.length} type="submit">ثبت منو</button></form></section></div>
</details>
      <details className="open:z-30 relative min-w-0 overflow-visible rounded-xl border border-[#d4e1e5] bg-white">
  <summary className="cursor-pointer border-b border-[#dce7ea] bg-[#edf3f5] px-5 py-4 text-sm font-semibold text-[#274d59] hover:bg-[#e1edf1]">افزودن گزینهٔ جانبی</summary>
<div className="p-3 pt-0"><section className="min-w-0 rounded-xl border border-line bg-white p-[18px]"><h2 className="mt-0 mb-[15px] text-base">افزودن گزینهٔ جانبی</h2><form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={(event) => void createCatalogItem(event)}><label className="flex flex-col gap-2 mb-[17px] text-sm font-semibold text-[#34393c] !m-0">نوع گزینه<select className="min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" onChange={(event) => setKind(event.target.value as CatalogKind)} value={kind}><option value="sides">ساید</option><option value="drinks">نوشیدنی</option></select></label><label className="flex flex-col gap-2 mb-[17px] text-sm font-semibold text-[#34393c] !m-0">نام<input className="min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" onChange={(event) => setItemName(event.target.value)} required value={itemName} /></label><label className="flex flex-col gap-2 mb-[17px] text-sm font-semibold text-[#34393c] !m-0 col-span-full">قیمت (تومان)<input className="min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" min={0} onChange={(event) => setItemPrice(event.target.value)} required type="number" value={itemPrice} /></label><button className={buttonClass('primary', 'col-span-full')} type="submit">افزودن گزینه</button></form></section></div>
</details>
      </div>
      </details>
      <details className="open:z-30 relative group overflow-visible rounded-xl border border-[#cbdde2] bg-white">
        <summary className="cursor-pointer bg-[#e4f0f3] px-5 py-5 text-base font-bold text-[#164c5a] hover:bg-[#d6e9ee]">
          فهرست کاتالوگ
        </summary>
        <div className="grid gap-3 bg-[#f4f8f9] p-4">
          <CatalogSummary foods={foods} sides={sides} drinks={drinks} />
      <CatalogInventory
        foods={foods}
        sides={sides}
        drinks={drinks}
        onChanged={async (message) => {
          await loadCatalog(true)
          setEditNotice(message)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />
        </div>
      </details>
    </div>}
  </section>
}

function CatalogSummary({ foods, sides, drinks }: { foods: CatalogItem[]; sides: CatalogItem[]; drinks: CatalogItem[] }) {
  return (
    <section
      aria-label="کاتالوگ موجود"
      className="col-span-full flex min-w-0 items-center justify-between gap-[18px] rounded-xl border border-line bg-white p-[18px] max-[680px]:col-auto max-[680px]:flex-col max-[680px]:items-start"
    >
      <h2 className="m-0 text-base">کاتالوگ موجود</h2>
      <div className="flex flex-wrap gap-[18px] text-[13px] text-muted max-[680px]:gap-3">
        <span>غذا <strong className="ms-[5px] text-ink">{foods.length}</strong></span>
        <span>ساید <strong className="ms-[5px] text-ink">{sides.length}</strong></span>
        <span>نوشیدنی <strong className="ms-[5px] text-ink">{drinks.length}</strong></span>
      </div>
    </section>
  )
}
