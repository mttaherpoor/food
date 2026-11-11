import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import type { Reservation, ReservationItem } from '../api/types'
import { server } from '../test/server'
import HistoryPage from './HistoryPage'

const baseItem: ReservationItem = {
  id: 501,
  building: 8,
  building_number_snapshot: '08',
  side_items: [],
  drink_items: [],
  side: null,
  side_name: null,
  drink: null,
  drink_name: null,
  food_price: 100_000,
  side_price: 0,
  drink_price: 0,
  food_quantity: 2,
  side_quantity: 0,
  drink_quantity: 0,
  is_current: true,
  is_cancelled: false,
  total_price: 200_000,
  datetime_created: '2026-11-11T08:00:00Z',
  datetime_modified: '2026-11-11T08:00:00Z',
}

function mockHistory(reservations: Reservation[]) {
  server.use(
    http.get('*/api/v1/reservations', () =>
      HttpResponse.json(reservations),
    ),
  )
}

describe('HistoryPage reservation snapshots', () => {
  it('displays all selected sides and drinks from historical snapshots', async () => {
    const user = userEvent.setup()

    const item: ReservationItem = {
      ...baseItem,
      side_items: [
        {
          side: 11,
          side_name: 'سالاد شیرازی',
          quantity: 2,
          unit_price: 20_000,
          total_price: 40_000,
        },
        {
          side: 12,
          side_name: 'ماست و موسیر',
          quantity: 1,
          unit_price: 15_000,
          total_price: 15_000,
        },
      ],
      drink_items: [
        {
          drink: 21,
          drink_name: 'نوشابه',
          quantity: 2,
          unit_price: 18_000,
          total_price: 36_000,
        },
      ],
      side_price: 55_000,
      drink_price: 36_000,
      side_quantity: 3,
      drink_quantity: 2,
      total_price: 291_000,
    }

    mockHistory([{
      id: 301,
      menu: 101,
      menu_date: '2026-11-12',
      food_name: 'قورمه سبزی',
      status: 'res',
      current_item: item,
      history: [item],
      total_price: 291_000,
    }])

    render(<HistoryPage />)

    expect(await screen.findByText('قورمه سبزی')).toBeInTheDocument()
    expect(screen.getByText('رزرو فعال')).toBeInTheDocument()

    const monthSummary = screen.getByLabelText('باز کردن خلاصه ماه')
    const monthDetails = monthSummary.closest('details')

    expect(monthDetails).not.toHaveAttribute('open')

    await user.click(monthSummary)

    expect(monthDetails).toHaveAttribute('open')

    await user.click(screen.getByText('مشاهده رزروهای ماه'))

    const details = screen.getByText(/جزئیات و سوابق/)
    await user.click(details)

    const panel = details.closest('details')
    expect(panel).not.toBeNull()
    if (!panel) throw new Error('History details not found')

    expect(within(panel).getByText(/سالاد شیرازی ×/)).toBeInTheDocument()
    expect(within(panel).getByText(/ماست و موسیر ×/)).toBeInTheDocument()
    expect(within(panel).getByText(/نوشابه ×/)).toBeInTheDocument()
    expect(screen.getByText('ساختمان 08')).toBeInTheDocument()
    expect(screen.getByText(/غذای اصلی:.*۲۰۰/)).toBeInTheDocument()
    expect(
      within(panel).queryByText('ساختمان 08'),
    ).not.toBeInTheDocument()

    expect(
      within(panel).queryByText('بدون پیش‌غذا و نوشیدنی'),
    ).not.toBeInTheDocument()
  })

  it('supports legacy selections and cancelled versions', async () => {
    const user = userEvent.setup()

    // Undefined array fields are omitted from JSON,
    // representing a response from the legacy API.
    const legacyItem = {
      ...baseItem,
      id: 601,
      side_items: undefined,
      drink_items: undefined,
      side: 11,
      side_name: 'سالاد قدیمی',
      side_quantity: 1,
      side_price: 12_000,
      food_quantity: 1,
      total_price: 112_000,
      is_current: false,
    }

    const cancelledItem: ReservationItem = {
      ...baseItem,
      id: 602,
      is_cancelled: true,
      total_price: 0,
      datetime_created: '2026-11-11T09:00:00Z',
    }

    mockHistory([{
      id: 401,
      menu: 102,
      menu_date: '2026-11-13',
      food_name: 'زرشک پلو',
      status: 'can',
      current_item: cancelledItem,
      history: [
        legacyItem as unknown as ReservationItem,
        cancelledItem,
      ],
      total_price: 0,
    }])

    render(<HistoryPage />)

    expect(await screen.findByText('زرشک پلو')).toBeInTheDocument()
    expect(screen.getByText('لغو شده')).toBeInTheDocument()

    const monthSummary = screen.getByLabelText('باز کردن خلاصه ماه')
    const monthDetails = monthSummary.closest('details')

    expect(monthDetails).not.toHaveAttribute('open')

    await user.click(monthSummary)

    expect(monthDetails).toHaveAttribute('open')

    await user.click(screen.getByText('مشاهده رزروهای ماه'))
    await user.click(screen.getByText(/جزئیات و سوابق/))

    expect(screen.getByText(/سالاد قدیمی ×/)).toBeInTheDocument()
    expect(screen.getByText('لغو رزرو')).toBeInTheDocument()
    const cancellation = screen.getByText('لغو رزرو').closest('li')

    expect(cancellation).not.toBeNull()

    if (!cancellation) {
      throw new Error('Cancellation history item not found')
    }

    expect(
      within(cancellation).getByText(/رویداد لغو رزرو است/),
    ).toBeInTheDocument()

    expect(
      within(cancellation).queryByText(/غذای اصلی/),
    ).not.toBeInTheDocument()

    expect(
      within(cancellation).queryByText('بدون پیش‌غذا و نوشیدنی'),
    ).not.toBeInTheDocument()
  })
})
