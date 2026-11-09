import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import BrandMark from '../components/layout/BrandMark'
import { getApiMessage } from '../utils/errors'

export default function LoginScreen({
  initialError,
  onSubmit,
}: {
  initialError: string
  onSubmit: (username: string, password: string) => Promise<void>
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)


  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSubmit(username.trim(), password)
    } catch (submitError) {
      setError(getApiMessage(submitError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main dir="rtl" className="block min-h-svh min-[681px]:grid min-[681px]:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
      <section className="login-intro relative flex min-h-svh flex-col justify-between overflow-hidden bg-[#164c5a] p-[clamp(32px,6vw,88px)] text-white max-[680px]:min-h-0 max-[680px]:px-[22px] max-[680px]:pt-6 max-[680px]:pb-[25px]" aria-labelledby="login-title">
        <BrandMark variant="login" />
        <p className="mt-auto mb-[14px] font-semibold text-[#b9d6dc]">پی‌آی فود · سامانه کارکنان</p>
        <h1 id="login-title" className="m-0 max-w-[580px] text-[clamp(40px,5vw,66px)] leading-[1.22] tracking-[-1.6px] max-[680px]:mt-6 max-[680px]:max-w-[420px] max-[680px]:text-[32px]">غذای این هفته‌ات را انتخاب کن.</h1>
        <p className="mt-[22px] mb-0 max-w-[480px] text-lg leading-[1.9] text-[#d0e0e3] max-[680px]:mt-3 max-[680px]:text-sm">با کد پرسنلی وارد شو و رزروهای روزانه‌ات را مدیریت کن.</p>
        <div className="relative z-[1] mt-[72px] grid grid-cols-5 gap-2 max-[680px]:hidden" aria-hidden="true">
          <span className="rounded-[10px] border border-[#ffffff24] px-2 py-[14px] text-center text-[13px] text-[#d6e8eb] max-[680px]:px-[3px] max-[680px]:py-[9px] max-[680px]:text-[10px]">شنبه</span><span className="rounded-[10px] border border-[#ffffff24] px-2 py-[14px] text-center text-[13px] text-[#d6e8eb] max-[680px]:px-[3px] max-[680px]:py-[9px] max-[680px]:text-[10px]">یکشنبه</span><span className="rounded-[10px] border border-[#ffffff24] px-2 py-[14px] text-center text-[13px] text-[#d6e8eb] max-[680px]:px-[3px] max-[680px]:py-[9px] max-[680px]:text-[10px]">دوشنبه</span><span className="rounded-[10px] border border-[#ffffff24] px-2 py-[14px] text-center text-[13px] text-[#d6e8eb] max-[680px]:px-[3px] max-[680px]:py-[9px] max-[680px]:text-[10px]">سه‌شنبه</span><span className="rounded-[10px] border border-[#ffffff24] px-2 py-[14px] text-center text-[13px] text-[#d6e8eb] max-[680px]:px-[3px] max-[680px]:py-[9px] max-[680px]:text-[10px]">چهارشنبه</span>
          <strong className="col-span-full mt-[10px] font-medium text-[#e5f0f2] max-[680px]:mt-[5px] max-[680px]:text-xs">هر روز، یک منو</strong>
        </div>
      </section>
      <section className="grid place-items-center p-8 max-[680px]:px-[23px] max-[680px]:pt-[30px] max-[680px]:pb-11">
        <form className="flex w-full max-w-[430px] flex-col items-stretch" onSubmit={submit}>
          <h2 className="mb-[9px] text-[27px] tracking-[-0.5px] max-[680px]:text-[23px]">ورود به حساب</h2>
          <p className="mb-7 leading-[1.8] text-muted">برای ادامه، کد پرسنلی و رمز عبورت را وارد کن.</p>
          <label className="mb-[17px] flex flex-col gap-2 text-sm font-semibold text-[#34393c]" htmlFor="personnel-number">کد پرسنلی</label>
          <input className="mb-5 min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink"
            autoComplete="username"
            autoCapitalize="none"
            id="personnel-number"
            inputMode="numeric"
            maxLength={32}
            onChange={(event) => setUsername(event.target.value)}
            required
            value={username}
          />
          <label className="mb-[17px] flex flex-col gap-2 text-sm font-semibold text-[#34393c]" htmlFor="password">رمز عبور</label>
          <input className="mb-5 min-h-[46px] w-full rounded-[9px] border border-[#d9dfe2] bg-white px-[13px] py-[10px] text-ink"
            autoComplete="current-password"
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {(error || initialError) && <p className="mb-[15px] rounded-[9px] border border-[#f0c9cb] bg-[#fff4f4] px-[14px] py-3 text-sm leading-[1.7] text-[#8b242a]" role="alert">{error || initialError}</p>}
          <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[9px] border border-transparent bg-accent px-[14px] py-[9px] text-sm font-semibold text-white! cursor-pointer transition-colors duration-150 hover:not-disabled:bg-[#145769] disabled:cursor-not-allowed disabled:opacity-55" disabled={busy} type="submit">
            {busy ? 'در حال ورود…' : 'ورود'}
            {!busy && <ChevronLeft aria-hidden="true" size={18} />}
          </button>
          <p className="mt-[17px] text-center text-[13px] leading-[1.8] text-muted">ورود نخستین‌بار با رمز اولیه نیازمند تغییر رمز است.</p>
        </form>
      </section>
    </main>
  )
}
