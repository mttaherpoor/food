import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '../test/server'
import { formatDate } from '../utils/date'
import ReportPage from './ReportPage'

const buildingsResponse = {
  buildings: [
    {
      building_number: '01',
      reserved_count: 3,
      days: [
        {
          date: '2026-12-01',
          food: 'قورمه سبزی',
          reserved_count: 2,
          food_quantity: 4,
        },
        {
          date: '2026-12-02',
          food: 'زرشک پلو',
          reserved_count: 1,
          food_quantity: 1,
        },
      ],
    },
    {
      building_number: '02',
      reserved_count: 1,
      days: [
        {
          date: '2026-12-01',
          food: 'عدس پلو',
          reserved_count: 1,
          food_quantity: 2,
        },
      ],
    },
  ],
}

function mockBuildings(
  response: typeof buildingsResponse = buildingsResponse,
) {
  server.use(
    http.get('*/api/v1/reports/daily/buildings', () =>
      HttpResponse.json(response),
    ),
  )
}

describe('Building-based daily report', () => {
  it('shows building cards and total active reservations', async () => {
    mockBuildings()
    render(<ReportPage />)

    expect(
      await screen.findByRole('button', {
        name: 'مشاهده گزارش ساختمان 01',
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: 'مشاهده گزارش ساختمان 02',
      }),
    ).toBeInTheDocument()

    expect(screen.getByText('مجموع رزروها:').parentElement)
      .toHaveTextContent('۴')
  })

  it('opens the selected building and displays daily food counts', async () => {
    const user = userEvent.setup()
    mockBuildings()
    render(<ReportPage />)

    await user.click(
      await screen.findByRole('button', {
        name: 'مشاهده گزارش ساختمان 01',
      }),
    )

    expect(
      screen.getByRole('heading', { name: 'ساختمان 01' }),
    ).toBeInTheDocument()

    expect(screen.getByText('قورمه سبزی')).toBeInTheDocument()
    expect(screen.getByText('زرشک پلو')).toBeInTheDocument()
    expect(screen.getByText(formatDate('2026-12-01')))
      .toBeInTheDocument()
    expect(screen.getByText(formatDate('2026-12-02')))
      .toBeInTheDocument()

    const dayCards = screen.getAllByRole('article')

    expect(dayCards).toHaveLength(2)
    expect(within(dayCards[0]).getByText('۲')).toBeInTheDocument()
    expect(within(dayCards[0]).getByText('۴')).toBeInTheDocument()
    expect(within(dayCards[1]).getAllByText('۱')).toHaveLength(2)
  })

  it('returns from daily details to building cards', async () => {
    const user = userEvent.setup()
    mockBuildings()
    render(<ReportPage />)

    await user.click(
      await screen.findByRole('button', {
        name: 'مشاهده گزارش ساختمان 02',
      }),
    )

    expect(screen.getByText('عدس پلو')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: 'بازگشت به ساختمان‌ها',
      }),
    )

    expect(
      screen.getByRole('button', {
        name: 'مشاهده گزارش ساختمان 01',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText('عدس پلو')).not.toBeInTheDocument()
  })

  it('clears the selected building after fetching a new date range', async () => {
    const user = userEvent.setup()
    let requestCount = 0

    server.use(
      http.get('*/api/v1/reports/daily/buildings', () => {
        requestCount += 1

        return HttpResponse.json(
          requestCount === 1
            ? buildingsResponse
            : {
                buildings: [{
                  building_number: '03',
                  reserved_count: 1,
                  days: [{
                    date: '2026-12-03',
                    food: 'غذای جدید',
                    reserved_count: 1,
                    food_quantity: 1,
                  }],
                }],
              },
        )
      }),
    )

    render(<ReportPage />)

    await user.click(
      await screen.findByRole('button', {
        name: 'مشاهده گزارش ساختمان 01',
      }),
    )

    await user.click(
      screen.getByRole('button', { name: 'نمایش گزارش' }),
    )

    expect(
      await screen.findByRole('button', {
        name: 'مشاهده گزارش ساختمان 03',
      }),
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('heading', { name: 'ساختمان 01' }),
    ).not.toBeInTheDocument()

    await waitFor(() => {
      expect(requestCount).toBeGreaterThanOrEqual(2)
    })
  })

  it('shows an empty state when no building has active reservations', async () => {
    mockBuildings({ buildings: [] })
    render(<ReportPage />)

    expect(
      await screen.findByText('رزروی برای ساختمان‌ها ثبت نشده'),
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('button', {
        name: /مشاهده گزارش ساختمان/,
      }),
    ).not.toBeInTheDocument()
  })

  it('shows an API error instead of building cards', async () => {
    server.use(
      http.get('*/api/v1/reports/daily/buildings', () =>
        HttpResponse.json(
          { detail: 'خطا در دریافت گزارش ساختمان‌ها' },
          { status: 500 },
        ),
      ),
    )

    render(<ReportPage />)

    expect(
      await screen.findByText('خطا در دریافت گزارش ساختمان‌ها'),
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('button', {
        name: /مشاهده گزارش ساختمان/,
      }),
    ).not.toBeInTheDocument()
  })

  it('ignores an older response arriving after the latest report', async () => {
    let releaseFirst: (() => void) | undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    let requests = 0

    server.use(
      http.get('*/api/v1/reports/daily/buildings', async () => {
        requests += 1

        if (requests === 1) {
          await firstGate
          return HttpResponse.json(buildingsResponse)
        }

        return HttpResponse.json({
          buildings: [{
            building_number: '03',
            reserved_count: 5,
            days: [{
              date: '2026-12-03',
              food: 'غذای جدید',
              reserved_count: 5,
              food_quantity: 6,
            }],
          }],
        })
      }),
    )

    render(<ReportPage />)

    await waitFor(() => {
      expect(requests).toBe(1)
    })

    const submitButton = screen.getByRole('button', {
      name: 'در حال دریافت…',
    })
    const form = submitButton.closest('form')

    expect(form).not.toBeNull()

    // Submit programmatically to simulate two overlapping requests.
    // The visible submit button is disabled during loading.
    fireEvent.submit(form!)

    expect(
      await screen.findByRole('button', {
        name: 'مشاهده گزارش ساختمان 03',
      }),
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('button', {
        name: 'مشاهده گزارش ساختمان 01',
      }),
    ).not.toBeInTheDocument()

    // Now resolve the older request.
    await act(async () => {
      releaseFirst?.()
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    })

    expect(
      screen.getByRole('button', {
        name: 'مشاهده گزارش ساختمان 03',
      }),
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('button', {
        name: 'مشاهده گزارش ساختمان 01',
      }),
    ).not.toBeInTheDocument()

    expect(requests).toBe(2)
  })

})
