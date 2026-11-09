import { useState } from 'react'
import type { FormEvent } from 'react'
import { changePassword } from '../api/endpoints'
import type { User } from '../api/types'
import BrandMark from '../components/layout/BrandMark'
import { getApiMessage } from '../utils/errors'

export default function PasswordScreen({ onSuccess }: { onSuccess: (session: User) => void }) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const session = await changePassword(oldPassword, newPassword, confirm)
      await onSuccess(session)
    } catch (submitError) {
      setError(getApiMessage(submitError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-[42px] p-7 max-[680px]:justify-start max-[680px]:gap-7 max-[680px]:px-[18px] max-[680px]:py-6">
      <BrandMark variant="default" />
      <form className="flex w-full max-w-[430px] flex-col items-stretch rounded-app border border-line bg-white p-8 max-[680px]:px-[18px] max-[680px]:py-[23px]" onSubmit={submit}>
        <h1 className="mb-[9px] text-[27px] tracking-[-0.5px]">یک رمز تازه انتخاب کن</h1>
        <p className="mb-7 leading-[1.8] text-muted">برای امنیت حساب، پیش از ادامه رمز اولیه را عوض کن.</p>
        <label className="mb-[17px] flex flex-col gap-2 text-sm font-semibold text-[#34393c]" htmlFor="old-password">رمز فعلی</label>
        <input className="mb-5 min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" autoComplete="current-password" id="old-password" onChange={(event) => setOldPassword(event.target.value)} required type="password" value={oldPassword} />
        <label className="mb-[17px] flex flex-col gap-2 text-sm font-semibold text-[#34393c]" htmlFor="new-password">رمز جدید</label>
        <input className="mb-5 min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" autoComplete="new-password" id="new-password" onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} />
        <label className="mb-[17px] flex flex-col gap-2 text-sm font-semibold text-[#34393c]" htmlFor="confirm-password">تکرار رمز جدید</label>
        <input className="mb-5 min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink" autoComplete="new-password" id="confirm-password" onChange={(event) => setConfirm(event.target.value)} required type="password" value={confirm} />
        <p className="-mt-[5px] mb-[18px] text-xs leading-[1.8] text-muted">رمز باید شرایط امنیتی سامانه را داشته باشد و با کد پرسنلی برابر نباشد.</p>
        {error && <p className="mb-[15px] rounded-[9px] border border-[#f0c9cb] bg-[#fff4f4] px-[14px] py-3 text-sm leading-[1.7] text-[#8b242a]" role="alert">{error}</p>}
        <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[9px] border border-transparent bg-accent px-[14px] py-[9px] text-sm font-semibold text-white! cursor-pointer transition-colors duration-150 hover:not-disabled:bg-[#145769] disabled:cursor-not-allowed disabled:opacity-55" disabled={busy} type="submit">{busy ? 'در حال ذخیره…' : 'ذخیرهٔ رمز جدید'}</button>
      </form>
    </main>
  )
}
