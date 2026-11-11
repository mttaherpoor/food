import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { KeyRound, Save, UserRound } from 'lucide-react'

import {
  changePassword,
  getProfile,
  getProfileOptions,
  updateProfile,
} from '../api/endpoints'
import type { Profile, ProfileOption, ProfileOptions } from '../api/types'
import { getApiMessage } from '../utils/errors'

function ProfileSelect({
  id,
  label,
  value,
  currentNumber,
  options,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: string
  currentNumber: string | null
  options: ProfileOption[]
  disabled: boolean
  onChange: (value: string) => void
}) {
  const currentIsUnavailable =
    value !== '' && !options.some((option) => String(option.id) === value)

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 lg:min-h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="" disabled>
          انتخاب {label}
        </option>
        {currentIsUnavailable && (
          <option value={value} disabled>
            {currentNumber ?? value} (غیرفعال)
          </option>
        )}
        {options.map((option) => (
          <option key={option.id} value={String(option.id)}>
            {option.number}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [options, setOptions] = useState<ProfileOptions | null>(null)
  const [building, setBuilding] = useState('')
  const [department, setDepartment] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  useEffect(() => {
    let active = true

    Promise.all([getProfile(), getProfileOptions()])
      .then(([data, available]) => {
        if (!active) return

        setProfile(data)
        setOptions(available)
        setBuilding(data.building === null ? '' : String(data.building))
        setDepartment(data.department === null ? '' : String(data.department))
        setLoadError('')
      })
      .catch((error: unknown) => {
        if (active) setLoadError(getApiMessage(error))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const buildingChanged =
    profile !== null &&
    building !== '' &&
    building !== String(profile.building ?? '')

  const departmentChanged =
    profile !== null &&
    department !== '' &&
    department !== String(profile.department ?? '')

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!profile || !options || saving) return
    if (!buildingChanged && !departmentChanged) return

    const changes: { building?: number; department?: number } = {}

    if (buildingChanged) {
      changes.building = Number(building)
    }

    if (departmentChanged) {
      changes.department = Number(department)
    }

    setSaving(true)
    setSaveError('')
    setSaveSuccess('')

    try {
      const updated = await updateProfile(changes)
      setProfile(updated)
      setBuilding(updated.building === null ? '' : String(updated.building))
      setDepartment(updated.department === null ? '' : String(updated.department))
      setSaveSuccess('اطلاعات پروفایل با موفقیت ذخیره شد.')
    } catch (error) {
      setSaveError(getApiMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (passwordBusy) return

    if (newPassword !== confirmPassword) {
      setPasswordError('رمز جدید و تکرار آن یکسان نیستند.')
      setPasswordSuccess('')
      return
    }

    setPasswordBusy(true)
    setPasswordError('')
    setPasswordSuccess('')

    try {
      await changePassword(oldPassword, newPassword, confirmPassword)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess('رمز عبور با موفقیت تغییر کرد.')
    } catch (error) {
      setPasswordError(getApiMessage(error))
    } finally {
      setPasswordBusy(false)
    }
  }

  if (loading) {
    return (
      <div role="status" className="py-16 text-center text-sm text-muted">
        در حال دریافت اطلاعات پروفایل…
      </div>
    )
  }

  if (loadError || !profile || !options) {
    return (
      <section className="rounded-xl border border-line bg-surface p-6">
        <h1 className="mb-3 text-xl font-bold">پروفایل</h1>
        <p role="alert" className="text-sm text-negative">
          {loadError || 'دریافت اطلاعات پروفایل امکان‌پذیر نیست.'}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 min-h-10 cursor-pointer rounded-lg border border-line px-4 text-sm"
        >
          تلاش مجدد
        </button>
      </section>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-[800px] flex-col gap-6 lg:gap-3" aria-labelledby="profile-title">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <UserRound aria-hidden="true" size={24} />
        </div>
        <div>
          <h1 id="profile-title" className="m-0 text-2xl font-bold text-ink">
            پروفایل
          </h1>
          <p className="mt-1 text-sm text-muted">
            اطلاعات و تنظیمات حساب کاربری
          </p>
        </div>
      </div>

      <form
        onSubmit={(event) => void savePreferences(event)}
        className="rounded-xl border border-line bg-surface p-6 max-[680px]:p-4 lg:p-4"
      >
        <h2 className="mb-5 text-lg font-bold text-ink lg:mb-3">اطلاعات پروفایل</h2>

        <div className="mb-5 flex flex-col gap-2 lg:mb-3">
          <label htmlFor="personnel-number" className="text-sm font-semibold text-ink">
            کد پرسنلی
          </label>
          <input
            id="personnel-number"
            value={profile.personnel_number}
            readOnly
            className="min-h-12 lg:min-h-10 rounded-lg border border-line bg-raised px-3 text-sm text-muted"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1 lg:gap-3">
          <ProfileSelect
            id="profile-building"
            label="شماره ساختمان"
            value={building}
            currentNumber={profile.building_number}
            options={options.buildings}
            disabled={saving}
            onChange={(value) => {
              setBuilding(value)
              setSaveError('')
              setSaveSuccess('')
            }}
          />
          <ProfileSelect
            id="profile-department"
            label="شماره دپارتمان"
            value={department}
            currentNumber={profile.department_number}
            options={options.departments}
            disabled={saving}
            onChange={(value) => {
              setDepartment(value)
              setSaveError('')
              setSaveSuccess('')
            }}
          />
        </div>

        {saveError && (
          <p role="alert" className="mt-4 text-sm text-negative">{saveError}</p>
        )}
        {saveSuccess && (
          <p role="status" className="mt-4 text-sm text-positive">{saveSuccess}</p>
        )}

        <div className="mt-6 flex justify-end lg:mt-3">
          <button
            type="submit"
            disabled={saving || (!buildingChanged && !departmentChanged)}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-[var(--accent-contrast)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save aria-hidden="true" size={17} />
            {saving ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
          </button>
        </div>
      </form>

      <form
        onSubmit={(event) => void savePassword(event)}
        className="rounded-xl border border-line bg-surface p-6 max-[680px]:p-4 lg:p-4"
      >
        <div className="mb-5 flex items-center gap-2 lg:mb-3">
          <KeyRound aria-hidden="true" className="text-accent" size={20} />
          <h2 className="m-0 text-lg font-bold text-ink">تغییر رمز عبور</h2>
        </div>

        <div className="flex flex-col gap-4 lg:gap-2">
          {[
            { id: 'current-password', label: 'رمز فعلی', value: oldPassword, setter: setOldPassword, complete: 'current-password' },
            { id: 'new-profile-password', label: 'رمز جدید', value: newPassword, setter: setNewPassword, complete: 'new-password' },
            { id: 'confirm-profile-password', label: 'تکرار رمز جدید', value: confirmPassword, setter: setConfirmPassword, complete: 'new-password' },
          ].map((field) => (
            <div key={field.id} className="flex flex-col gap-2">
              <label htmlFor={field.id} className="text-sm font-semibold text-ink">
                {field.label}
              </label>
              <input
                id={field.id}
                type="password"
                autoComplete={field.complete}
                required
                value={field.value}
                disabled={passwordBusy}
                onChange={(event) => {
                  field.setter(event.target.value)
                  setPasswordError('')
                  setPasswordSuccess('')
                }}
                className="min-h-12 lg:min-h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
              />
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs leading-7 text-muted lg:mt-2">
          رمز جدید باید شرایط امنیتی سامانه را داشته باشد و با کد پرسنلی یکسان نباشد.
        </p>

        {passwordError && (
          <p role="alert" className="mt-3 text-sm text-negative">{passwordError}</p>
        )}
        {passwordSuccess && (
          <p role="status" className="mt-3 text-sm text-positive">{passwordSuccess}</p>
        )}

        <div className="mt-5 flex justify-end lg:mt-3">
          <button
            type="submit"
            disabled={passwordBusy}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-[var(--accent-contrast)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <KeyRound aria-hidden="true" size={17} />
            {passwordBusy ? 'در حال تغییر…' : 'تغییر رمز عبور'}
          </button>
        </div>
      </form>
    </section>
  )
}
