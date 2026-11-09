import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import JalaliDatePicker, {
  displayJalaliISO,
  jalaliMonthStartISO,
} from './JalaliDatePicker'

const initialDate = '2026-11-09'

describe('JalaliDatePicker', () => {
  it('displays a Persian date from an ISO value', () => {
    render(
      <JalaliDatePicker
        value={initialDate}
        onChange={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', {
        name: displayJalaliISO(initialDate),
      }),
    ).toBeInTheDocument()
  })

  it('opens the calendar and changes visible months', async () => {
    const user = userEvent.setup()

    render(
      <JalaliDatePicker
        value={initialDate}
        onChange={vi.fn()}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: displayJalaliISO(initialDate),
      }),
    )

    const dialog = screen.getByRole('dialog', {
      name: 'تقویم شمسی',
    })

    const initialHeading = dialog.querySelector('strong')?.textContent

    await user.click(
      within(dialog).getByRole('button', { name: 'ماه بعد' }),
    )

    expect(dialog.querySelector('strong')?.textContent)
      .not.toBe(initialHeading)

    await user.click(
      within(dialog).getByRole('button', { name: 'ماه قبل' }),
    )

    expect(dialog.querySelector('strong')?.textContent)
      .toBe(initialHeading)
  })

  it('returns a Gregorian ISO date when a day is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <JalaliDatePicker
        value={initialDate}
        onChange={onChange}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: displayJalaliISO(initialDate),
      }),
    )

    const dialog = screen.getByRole('dialog')

    const target = dialog.querySelector<HTMLButtonElement>(
      'button[data-iso="2026-11-10"]',
    )

    expect(target).not.toBeNull()

    await user.click(target!)

    expect(onChange).toHaveBeenCalledExactlyOnceWith(
      '2026-11-10',
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the calendar with Escape without changing the date', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <JalaliDatePicker
        value={initialDate}
        onChange={onChange}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: displayJalaliISO(initialDate),
      }),
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('returns the first day of the same Jalali month', () => {
    const firstDay = jalaliMonthStartISO(initialDate)
    const original = displayJalaliISO(initialDate)
    const start = displayJalaliISO(firstDay)

    expect(start.split('/').slice(0, 2))
      .toEqual(original.split('/').slice(0, 2))

    expect(start.endsWith('/۰۱')).toBe(true)
  })

  it('disables the date trigger when disabled', () => {
    render(
      <JalaliDatePicker
        value={initialDate}
        onChange={vi.fn()}
        disabled
      />,
    )

    expect(
      screen.getByRole('button', {
        name: displayJalaliISO(initialDate),
      }),
    ).toBeDisabled()
  })
})
